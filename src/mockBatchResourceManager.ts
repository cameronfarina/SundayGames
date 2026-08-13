export interface MockBatchResourceScope {
  accountId: string;
  seasonId: string;
}

export interface MockBatchResourceLimits {
  maxRunningGlobal: number;
  maxRunningPerAccount: number;
  maxRunningPerSeason: number;
  maxQueuedGlobal: number;
  maxQueuedPerAccount: number;
  maxQueuedPerSeason: number;
  retryAfterSeconds: number;
}

export const defaultMockBatchResourceLimits: MockBatchResourceLimits = {
  maxRunningGlobal: 4,
  maxRunningPerAccount: 2,
  maxRunningPerSeason: 1,
  maxQueuedGlobal: 16,
  maxQueuedPerAccount: 4,
  maxQueuedPerSeason: 2,
  retryAfterSeconds: 5,
};

export type MockBatchCapacityErrorCode =
  | "account_queue_full"
  | "global_queue_full"
  | "season_queue_full";

export class MockBatchCapacityError extends Error {
  constructor(
    readonly code: MockBatchCapacityErrorCode,
    message: string,
    readonly status: 429 | 503,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "MockBatchCapacityError";
  }
}

interface QueuedMockBatchWork {
  scope: MockBatchResourceScope;
  work: () => Promise<void>;
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
};

export class MockBatchResourceManager {
  readonly #limits: MockBatchResourceLimits;
  readonly #queue: QueuedMockBatchWork[] = [];
  readonly #runningByAccount = new Map<string, number>();
  readonly #runningBySeason = new Map<string, number>();
  readonly #idleWaiters = new Set<() => void>();
  #runningGlobal = 0;

  constructor(limits: MockBatchResourceLimits = defaultMockBatchResourceLimits) {
    this.#limits = {
      maxRunningGlobal: positiveInteger(limits.maxRunningGlobal, "maxRunningGlobal"),
      maxRunningPerAccount: positiveInteger(limits.maxRunningPerAccount, "maxRunningPerAccount"),
      maxRunningPerSeason: positiveInteger(limits.maxRunningPerSeason, "maxRunningPerSeason"),
      maxQueuedGlobal: positiveInteger(limits.maxQueuedGlobal, "maxQueuedGlobal"),
      maxQueuedPerAccount: positiveInteger(limits.maxQueuedPerAccount, "maxQueuedPerAccount"),
      maxQueuedPerSeason: positiveInteger(limits.maxQueuedPerSeason, "maxQueuedPerSeason"),
      retryAfterSeconds: positiveInteger(limits.retryAfterSeconds, "retryAfterSeconds"),
    };
  }

  submit(
    scope: MockBatchResourceScope,
    work: () => Promise<void>,
  ): { state: "running" | "queued" } {
    if (this.#canRun(scope)) {
      this.#start({ scope, work });
      return { state: "running" };
    }

    const queuedForAccount = this.#queue.filter(entry => entry.scope.accountId === scope.accountId).length;
    if (queuedForAccount >= this.#limits.maxQueuedPerAccount) {
      throw new MockBatchCapacityError(
        "account_queue_full",
        "Too many mock batches are already queued for this account.",
        429,
        this.#limits.retryAfterSeconds,
      );
    }
    const seasonKey = this.#seasonKey(scope);
    const queuedForSeason = this.#queue.filter(entry => this.#seasonKey(entry.scope) === seasonKey).length;
    if (queuedForSeason >= this.#limits.maxQueuedPerSeason) {
      throw new MockBatchCapacityError(
        "season_queue_full",
        "Too many mock batches are already queued for this league season.",
        429,
        this.#limits.retryAfterSeconds,
      );
    }
    if (this.#queue.length >= this.#limits.maxQueuedGlobal) {
      throw new MockBatchCapacityError(
        "global_queue_full",
        "Mock draft capacity is temporarily full.",
        503,
        this.#limits.retryAfterSeconds,
      );
    }

    this.#queue.push({ scope, work });
    return { state: "queued" };
  }

  whenIdle(): Promise<void> {
    if (this.#runningGlobal === 0 && this.#queue.length === 0) return Promise.resolve();

    return new Promise(resolve => this.#idleWaiters.add(resolve));
  }

  #seasonKey(scope: MockBatchResourceScope): string {
    return scope.seasonId;
  }

  #canRun(scope: MockBatchResourceScope): boolean {
    return this.#runningGlobal < this.#limits.maxRunningGlobal &&
      (this.#runningByAccount.get(scope.accountId) ?? 0) < this.#limits.maxRunningPerAccount &&
      (this.#runningBySeason.get(this.#seasonKey(scope)) ?? 0) < this.#limits.maxRunningPerSeason;
  }

  #start(entry: QueuedMockBatchWork): void {
    const seasonKey = this.#seasonKey(entry.scope);
    this.#runningGlobal += 1;
    this.#runningByAccount.set(
      entry.scope.accountId,
      (this.#runningByAccount.get(entry.scope.accountId) ?? 0) + 1,
    );
    this.#runningBySeason.set(seasonKey, (this.#runningBySeason.get(seasonKey) ?? 0) + 1);

    void Promise.resolve()
      .then(entry.work)
      .catch(() => {
        // The submitted job owns its terminal error state.
      })
      .finally(() => {
        this.#runningGlobal -= 1;
        this.#decrement(this.#runningByAccount, entry.scope.accountId);
        this.#decrement(this.#runningBySeason, seasonKey);
        this.#drain();
      });
  }

  #decrement(counts: Map<string, number>, key: string): void {
    const next = (counts.get(key) ?? 1) - 1;
    if (next <= 0) counts.delete(key);
    else counts.set(key, next);
  }

  #drain(): void {
    let started = true;
    while (started && this.#queue.length > 0) {
      started = false;
      const index = this.#queue.findIndex(entry => this.#canRun(entry.scope));
      if (index >= 0) {
        const [entry] = this.#queue.splice(index, 1);
        if (entry !== undefined) this.#start(entry);
        started = true;
      }
    }

    if (this.#runningGlobal === 0 && this.#queue.length === 0) {
      for (const resolve of this.#idleWaiters) resolve();
      this.#idleWaiters.clear();
    }
  }
}
