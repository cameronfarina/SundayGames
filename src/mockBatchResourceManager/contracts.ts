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

export interface QueuedMockBatchWork {
  scope: MockBatchResourceScope;
  work: () => Promise<void>;
}
