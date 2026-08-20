import type { DraftStreamClient, ExpectedDraftEvent } from "./draftStreamContracts.js";
import { elapsedMeasurement, type LoadMeasurement } from "./metrics.js";
import { DraftSseParser, SseContractError, type DraftSseEvent } from "./sse.js";

interface EventWaiter extends ExpectedDraftEvent {
  finish(diagnostic: string): void;
}
class StreamOpenError extends Error {
  constructor(readonly diagnostic: string) { super(diagnostic); }
}
export class DraftStreamConnection {
  readonly #events: DraftSseEvent[] = [];
  readonly #waiters = new Set<EventWaiter>();
  #controller: AbortController | undefined;
  #expectedClose = false;
  #monitor: Promise<void> | undefined;
  #parser: DraftSseParser | undefined;
  #reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

  constructor(
    readonly client: DraftStreamClient,
    readonly baseUrl: URL,
    readonly connectTimeoutMs: number,
    readonly onRuntimeFailure: (diagnostic: string) => void,
  ) {}

  async open(expectedInitialRevision?: number): Promise<LoadMeasurement> {
    const startedAt = performance.now();
    const controller = new AbortController();
    this.#controller = controller;
    const timeout = setTimeout(() => controller.abort(), this.connectTimeoutMs);
    let status: number | undefined;
    try {
      const response = await fetch(new URL(
        `/live-rooms/${encodeURIComponent(this.client.roomId)}/event-stream`,
        this.baseUrl,
      ), {
        headers: { accept: "text/event-stream", "x-session-token": this.client.sessionToken },
        redirect: "error",
        signal: controller.signal,
      });
      status = response.status;
      if (status !== 200) throw new StreamOpenError(`http_${String(status)}`);
      const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase();
      if (contentType !== "text/event-stream") throw new StreamOpenError("unexpected_content_type");
      if (response.body === null) throw new StreamOpenError("missing_response_body");
      this.#reader = response.body.getReader();
      this.#parser = new DraftSseParser();
      await this.#readInitialSnapshot(expectedInitialRevision);
      this.#monitor = this.#consume();
      return elapsedMeasurement("ok", startedAt, status);
    } catch (error) {
      controller.abort();
      await this.#reader?.cancel().catch(() => undefined);
      const diagnostic = error instanceof StreamOpenError ? error.diagnostic : "request_error";
      return elapsedMeasurement(diagnostic, startedAt, status);
    } finally {
      clearTimeout(timeout);
    }
  }

  async #readInitialSnapshot(expectedRevision?: number): Promise<void> {
    while (true) {
      const next = await this.#reader?.read();
      if (next === undefined || next.done) throw new StreamOpenError("invalid_initial_snapshot");
      let events: readonly DraftSseEvent[];
      try { events = this.#parser?.push(next.value) ?? []; }
      catch (error) {
        if (error instanceof SseContractError) throw new StreamOpenError("invalid_initial_snapshot");
        throw error;
      }
      if (events.length === 0) {
        if ((this.#parser?.bufferedCharacterCount() ?? 0) > 64 * 1024) {
          throw new StreamOpenError("initial_snapshot_too_large");
        }
        continue;
      }
      const initial = events[0];
      if (initial?.event !== "room.snapshot" || initial.roomId !== this.client.roomId) {
        throw new StreamOpenError("invalid_initial_snapshot");
      }
      if (expectedRevision !== undefined && initial.revision !== expectedRevision) {
        throw new StreamOpenError("unexpected_initial_snapshot_revision");
      }
      for (const event of events) this.#record(event);
      return;
    }
  }

  async #consume(): Promise<void> {
    try {
      while (true) {
        const next = await this.#reader?.read();
        if (next === undefined || next.done) break;
        for (const event of this.#parser?.push(next.value) ?? []) this.#record(event);
      }
      if (!this.#expectedClose) this.onRuntimeFailure("unexpected_close");
    } catch (error) {
      if (!this.#expectedClose) {
        this.onRuntimeFailure(error instanceof SseContractError ? "invalid_sse_event" : "stream_read_error");
      }
    } finally {
      for (const waiter of [...this.#waiters]) {
        waiter.finish("stream_closed_before_event");
      }
    }
  }

  #record(event: DraftSseEvent): void {
    if (event.roomId !== this.client.roomId) {
      this.onRuntimeFailure("unexpected_room_event");
      return;
    }
    this.#events.push(event);
    if (this.#events.length > 100) this.#events.shift();
    for (const waiter of [...this.#waiters]) {
      if (event.event === waiter.event && event.revision === waiter.revision) {
        waiter.finish("ok");
      }
    }
  }

  async waitForEvent(expected: ExpectedDraftEvent): Promise<LoadMeasurement> {
    const startedAt = performance.now();
    if (this.#events.some(event => event.event === expected.event && event.revision === expected.revision)) {
      return elapsedMeasurement("ok", startedAt);
    }
    if (this.#monitor === undefined) return elapsedMeasurement("stream_unavailable", startedAt);
    return await new Promise(resolve => {
      let timer: ReturnType<typeof setTimeout>;
      const waiter: EventWaiter = {
        ...expected,
        finish: diagnostic => {
          clearTimeout(timer);
          this.#waiters.delete(waiter);
          resolve(elapsedMeasurement(diagnostic, startedAt));
        },
      };
      timer = setTimeout(() => waiter.finish("event_timeout"), expected.timeoutMs);
      this.#waiters.add(waiter);
    });
  }

  async close(): Promise<void> {
    this.#expectedClose = true;
    await this.#reader?.cancel().catch(() => undefined);
    this.#controller?.abort();
    await this.#monitor;
  }
}
