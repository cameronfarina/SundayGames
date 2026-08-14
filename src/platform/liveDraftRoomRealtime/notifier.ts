import type {
  LiveDraftRoomRevisionNotifierOptions,
  LiveDraftRoomRevisionSubscription,
  SubscribeToLiveDraftRoomRevisionsInput,
  WaitForLiveDraftRoomRevisionInput,
} from "./contracts.js";
import {
  defaultLiveDraftRoomConcurrentWaiters,
  defaultLiveDraftRoomConcurrentWaitersPerAccount,
  defaultLiveDraftRoomWaitRetryAfterSeconds,
  defaultRevisionWaitTimeoutMs,
  LiveDraftRoomWaitLimitError,
  requirePositiveSafeInteger,
} from "./limits.js";
import { maybeUnref } from "./timers.js";

interface RevisionWaiter {
  afterRevision: number;
  resolve: (notified: boolean) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class LiveDraftRoomRevisionNotifier {
  readonly #latestRevisionByRoomId = new Map<string, number>();
  readonly #waitersByRoomId = new Map<string, Set<RevisionWaiter>>();
  readonly #subscriptionCountByAccountId = new Map<string, number>();
  readonly #maxConcurrentWaitersPerAccount: number;
  readonly #maxConcurrentWaiters: number;
  readonly #retryAfterSeconds: number;
  #subscriptionCount = 0;

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

  subscribe(input: SubscribeToLiveDraftRoomRevisionsInput): LiveDraftRoomRevisionSubscription {
    const accountCount = this.#subscriptionCountByAccountId.get(input.accountId) ?? 0;
    if (accountCount >= this.#maxConcurrentWaitersPerAccount) {
      throw new LiveDraftRoomWaitLimitError("account", this.#retryAfterSeconds);
    }
    if (this.#subscriptionCount >= this.#maxConcurrentWaiters) {
      throw new LiveDraftRoomWaitLimitError("global", this.#retryAfterSeconds);
    }
    this.#subscriptionCountByAccountId.set(input.accountId, accountCount + 1);
    this.#subscriptionCount += 1;
    const lifetimeAbort = new AbortController();
    let closed = false;
    return {
      waitForRevision: waitInput => this.#waitForRevision({
        roomId: input.roomId,
        afterRevision: waitInput.afterRevision,
        timeoutMs: waitInput.timeoutMs,
        signal: waitInput.signal === undefined
          ? lifetimeAbort.signal
          : AbortSignal.any([waitInput.signal, lifetimeAbort.signal]),
      }),
      close: () => {
        if (closed) return;
        closed = true;
        lifetimeAbort.abort();
        const nextCount = (this.#subscriptionCountByAccountId.get(input.accountId) ?? 1) - 1;
        if (nextCount === 0) this.#subscriptionCountByAccountId.delete(input.accountId);
        else this.#subscriptionCountByAccountId.set(input.accountId, nextCount);
        this.#subscriptionCount -= 1;
      },
    };
  }

  async waitForRevision(input: WaitForLiveDraftRoomRevisionInput): Promise<boolean> {
    const subscription = this.subscribe({ accountId: input.accountId, roomId: input.roomId });
    try {
      return await subscription.waitForRevision({
        afterRevision: input.afterRevision,
        timeoutMs: input.timeoutMs,
        signal: input.signal,
      });
    } finally {
      subscription.close();
    }
  }

  #waitForRevision(input: {
    roomId: string;
    afterRevision: number;
    timeoutMs?: number | undefined;
    signal?: AbortSignal | undefined;
  }): Promise<boolean> {
    const latestRevision = this.#latestRevisionByRoomId.get(input.roomId);
    if (latestRevision !== undefined && latestRevision > input.afterRevision) return Promise.resolve(true);
    const timeoutMs = input.timeoutMs ?? defaultRevisionWaitTimeoutMs;
    if (timeoutMs <= 0 || input.signal?.aborted === true) return Promise.resolve(false);
    return new Promise(resolve => {
      let waiter: RevisionWaiter | undefined;
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
        }
        input.signal?.removeEventListener("abort", abort);
        resolve(notified);
      };
      const timer = setTimeout(() => complete(false), timeoutMs);
      maybeUnref(timer);
      waiter = { afterRevision: input.afterRevision, resolve: complete, timer };
      const waiters = this.#waitersByRoomId.get(input.roomId) ?? new Set<RevisionWaiter>();
      waiters.add(waiter);
      this.#waitersByRoomId.set(input.roomId, waiters);
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
