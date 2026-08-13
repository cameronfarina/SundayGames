interface LiveDraftRoomRevisionWaiter {
  afterRevision: number;
  resolve: (notified: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface WaitForLiveDraftRoomRevisionInput {
  accountId: string;
  roomId: string;
  afterRevision: number;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface LiveDraftRoomRevisionNotifierOptions {
  maxConcurrentWaitersPerAccount?: number | undefined;
  maxConcurrentWaiters?: number | undefined;
  retryAfterSeconds?: number | undefined;
}

export type LiveDraftRoomWaitLimitScope = "account" | "global";

export const defaultLiveDraftRoomConcurrentWaitersPerAccount = 4;
export const defaultLiveDraftRoomConcurrentWaiters = 200;
export const defaultLiveDraftRoomWaitRetryAfterSeconds = 5;
const defaultRevisionWaitTimeoutMs = 25_000;

export class LiveDraftRoomWaitLimitError extends Error {
  constructor(
    readonly scope: LiveDraftRoomWaitLimitScope,
    readonly retryAfterSeconds: number,
  ) {
    super(`Live draft event-stream ${scope} connection limit reached.`);
    this.name = "LiveDraftRoomWaitLimitError";
  }
}

const requirePositiveSafeInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }

  return value;
};

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
  readonly #waiterCountByAccountId = new Map<string, number>();
  readonly #maxConcurrentWaitersPerAccount: number;
  readonly #maxConcurrentWaiters: number;
  readonly #retryAfterSeconds: number;
  #waiterCount = 0;

  constructor(options: LiveDraftRoomRevisionNotifierOptions = {}) {
    this.#maxConcurrentWaitersPerAccount = requirePositiveSafeInteger(
      options.maxConcurrentWaitersPerAccount ?? defaultLiveDraftRoomConcurrentWaitersPerAccount,
      "maxConcurrentWaitersPerAccount",
    );
    this.#maxConcurrentWaiters = requirePositiveSafeInteger(
      options.maxConcurrentWaiters ?? defaultLiveDraftRoomConcurrentWaiters,
      "maxConcurrentWaiters",
    );
    this.#retryAfterSeconds = requirePositiveSafeInteger(
      options.retryAfterSeconds ?? defaultLiveDraftRoomWaitRetryAfterSeconds,
      "retryAfterSeconds",
    );
  }

  waitForRevision(input: WaitForLiveDraftRoomRevisionInput): Promise<boolean> {
    const latestRevision = this.#latestRevisionByRoomId.get(input.roomId);
    if (latestRevision !== undefined && latestRevision > input.afterRevision) {
      return Promise.resolve(true);
    }

    const timeoutMs = input.timeoutMs ?? defaultRevisionWaitTimeoutMs;
    if (timeoutMs <= 0 || input.signal?.aborted === true) return Promise.resolve(false);

    const accountWaiterCount = this.#waiterCountByAccountId.get(input.accountId) ?? 0;
    if (accountWaiterCount >= this.#maxConcurrentWaitersPerAccount) {
      return Promise.reject(new LiveDraftRoomWaitLimitError("account", this.#retryAfterSeconds));
    }
    if (this.#waiterCount >= this.#maxConcurrentWaiters) {
      return Promise.reject(new LiveDraftRoomWaitLimitError("global", this.#retryAfterSeconds));
    }

    return new Promise(resolve => {
      let waiter: LiveDraftRoomRevisionWaiter | undefined;
      let completed = false;
      const abort = (): void => complete(false);
      const complete = (notified: boolean): void => {
        if (completed) return;
        completed = true;
        if (waiter !== undefined) {
          clearTimeout(waiter.timer);
          const roomWaiters = this.#waitersByRoomId.get(input.roomId);
          roomWaiters?.delete(waiter);
          if (roomWaiters?.size === 0) this.#waitersByRoomId.delete(input.roomId);

          const nextAccountWaiterCount =
            (this.#waiterCountByAccountId.get(input.accountId) ?? 1) - 1;
          if (nextAccountWaiterCount === 0) this.#waiterCountByAccountId.delete(input.accountId);
          else this.#waiterCountByAccountId.set(input.accountId, nextAccountWaiterCount);
          this.#waiterCount -= 1;
        }
        input.signal?.removeEventListener("abort", abort);
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
      this.#waiterCountByAccountId.set(input.accountId, accountWaiterCount + 1);
      this.#waiterCount += 1;
      input.signal?.addEventListener("abort", abort, { once: true });
      if (input.signal?.aborted === true) complete(false);
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
