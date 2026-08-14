import {
  defaultMockBatchResourceLimits,
  MockBatchCapacityError,
  type MockBatchResourceLimits,
  type MockBatchResourceScope,
  type QueuedMockBatchWork,
} from "./contracts.js";
import { validatedLimits } from "./limits.js";

const decrement = (counts: Map<string, number>, key: string): void => {
  const next = (counts.get(key) ?? 1) - 1;
  if (next <= 0) counts.delete(key);
  else counts.set(key, next);
};

export class MockBatchResourceManager {
  readonly #limits: MockBatchResourceLimits;
  readonly #queue: QueuedMockBatchWork[] = [];
  readonly #runningByAccount = new Map<string, number>();
  readonly #runningBySeason = new Map<string, number>();
  readonly #idleWaiters = new Set<() => void>();
  #runningGlobal = 0;

  constructor(limits: MockBatchResourceLimits = defaultMockBatchResourceLimits) {
    this.#limits = validatedLimits(limits);
  }

  submit(
    scope: MockBatchResourceScope,
    work: () => Promise<void>,
  ): { state: "running" | "queued" } {
    if (this.#canRun(scope)) {
      this.#start({ scope, work });
      return { state: "running" };
    }
    this.#assertQueueCapacity(scope);
    this.#queue.push({ scope, work });
    return { state: "queued" };
  }

  whenIdle(): Promise<void> {
    if (this.#runningGlobal === 0 && this.#queue.length === 0) return Promise.resolve();
    return new Promise(resolve => this.#idleWaiters.add(resolve));
  }

  #assertQueueCapacity(scope: MockBatchResourceScope): void {
    const accountQueued = this.#queue.filter(
      entry => entry.scope.accountId === scope.accountId,
    ).length;
    if (accountQueued >= this.#limits.maxQueuedPerAccount) {
      throw new MockBatchCapacityError(
        "account_queue_full",
        "Too many mock batches are already queued for this account.",
        429,
        this.#limits.retryAfterSeconds,
      );
    }
    const seasonQueued = this.#queue.filter(
      entry => entry.scope.seasonId === scope.seasonId,
    ).length;
    if (seasonQueued >= this.#limits.maxQueuedPerSeason) {
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
  }

  #canRun(scope: MockBatchResourceScope): boolean {
    return this.#runningGlobal < this.#limits.maxRunningGlobal
      && (this.#runningByAccount.get(scope.accountId) ?? 0)
        < this.#limits.maxRunningPerAccount
      && (this.#runningBySeason.get(scope.seasonId) ?? 0)
        < this.#limits.maxRunningPerSeason;
  }

  #start(entry: QueuedMockBatchWork): void {
    this.#runningGlobal += 1;
    this.#increment(this.#runningByAccount, entry.scope.accountId);
    this.#increment(this.#runningBySeason, entry.scope.seasonId);
    void Promise.resolve().then(entry.work).catch(() => {
      // The submitted job owns its terminal error state.
    }).finally(() => {
      this.#runningGlobal -= 1;
      decrement(this.#runningByAccount, entry.scope.accountId);
      decrement(this.#runningBySeason, entry.scope.seasonId);
      this.#drain();
    });
  }

  #increment(counts: Map<string, number>, key: string): void {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  #drain(): void {
    let nextIndex = this.#queue.findIndex(entry => this.#canRun(entry.scope));
    while (nextIndex >= 0) {
      const [entry] = this.#queue.splice(nextIndex, 1);
      if (entry !== undefined) this.#start(entry);
      nextIndex = this.#queue.findIndex(candidate => this.#canRun(candidate.scope));
    }
    if (this.#runningGlobal === 0 && this.#queue.length === 0) {
      for (const resolve of this.#idleWaiters) resolve();
      this.#idleWaiters.clear();
    }
  }
}
