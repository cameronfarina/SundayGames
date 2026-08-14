import { vi } from "vitest";

export class FakeEventSource {
  static latest: FakeEventSource | undefined;
  static created = 0;
  readonly url: string;
  readonly listeners = new Map<string, EventListener[]>();
  onerror: ((event: Event) => void) | null = null;
  onopen: ((event: Event) => void) | null = null;
  readonly close = vi.fn();

  constructor(url: string | URL) {
    this.url = String(url);
    FakeEventSource.latest = this;
    FakeEventSource.created += 1;
  }

  addEventListener(type: string, listener: EventListener) {
    const listeners = this.listeners.get(type) ?? [];
    this.listeners.set(type, [...listeners, listener]);
  }

  emit(type: string, data: unknown) {
    this.emitRaw(type, JSON.stringify(data));
  }

  emitRaw(type: string, data: string) {
    this.emitEvent(type, new MessageEvent(type, { data }));
  }

  emitEvent(type: string, event: Event) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener(event);
    }
  }

  static reset() {
    FakeEventSource.latest = undefined;
    FakeEventSource.created = 0;
  }
}
