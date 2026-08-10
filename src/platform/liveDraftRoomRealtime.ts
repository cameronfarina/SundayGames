interface LiveDraftRoomRevisionWaiter {
  afterRevision: number;
  resolve: (notified: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WaitForLiveDraftRoomRevisionInput {
  roomId: string;
  afterRevision: number;
  timeoutMs?: number | undefined;
}

const defaultRevisionWaitTimeoutMs = 25_000;

const maybeUnref = (timer: ReturnType<typeof setTimeout>): void => {
  if (
    typeof timer === "object" &&
    timer !== null &&
    "unref" in timer &&
    typeof timer.unref === "function"
  ) {
    timer.unref();
  }
};

export class LiveDraftRoomRevisionNotifier {
  readonly #latestRevisionByRoomId = new Map<string, number>();
  readonly #waitersByRoomId = new Map<string, Set<LiveDraftRoomRevisionWaiter>>();

  waitForRevision(input: WaitForLiveDraftRoomRevisionInput): Promise<boolean> {
    const latestRevision = this.#latestRevisionByRoomId.get(input.roomId);
    if (latestRevision !== undefined && latestRevision > input.afterRevision) {
      return Promise.resolve(true);
    }

    const timeoutMs = input.timeoutMs ?? defaultRevisionWaitTimeoutMs;
    if (timeoutMs <= 0) return Promise.resolve(false);

    return new Promise(resolve => {
      let waiter: LiveDraftRoomRevisionWaiter | undefined;
      const complete = (notified: boolean): void => {
        if (waiter !== undefined) {
          clearTimeout(waiter.timer);
          this.#waitersByRoomId.get(input.roomId)?.delete(waiter);
        }
        resolve(notified);
      };
      const timer = setTimeout(() => complete(false), timeoutMs);
      maybeUnref(timer);

      waiter = {
        afterRevision: input.afterRevision,
        resolve: complete,
        timer,
      };

      const waiters = this.#waitersByRoomId.get(input.roomId) ?? new Set<LiveDraftRoomRevisionWaiter>();
      waiters.add(waiter);
      this.#waitersByRoomId.set(input.roomId, waiters);
    });
  }

  notifyRevision(roomId: string, revision: number): void {
    const latestRevision = this.#latestRevisionByRoomId.get(roomId) ?? 0;
    if (revision > latestRevision) this.#latestRevisionByRoomId.set(roomId, revision);

    const waiters = this.#waitersByRoomId.get(roomId);
    if (waiters === undefined) return;

    for (const waiter of [...waiters]) {
      if (revision > waiter.afterRevision) waiter.resolve(true);
    }

    if (waiters.size === 0) this.#waitersByRoomId.delete(roomId);
  }
}
