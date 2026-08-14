export interface WaitForLiveDraftRoomRevisionInput {
  accountId: string;
  roomId: string;
  afterRevision: number;
  timeoutMs?: number | undefined;
  signal?: AbortSignal | undefined;
}

export interface SubscribeToLiveDraftRoomRevisionsInput {
  accountId: string;
  roomId: string;
}

export interface LiveDraftRoomRevisionSubscription {
  waitForRevision(input: {
    afterRevision: number;
    timeoutMs?: number | undefined;
    signal?: AbortSignal | undefined;
  }): Promise<boolean>;
  close(): void;
}

export interface LiveDraftRoomRevisionNotifierOptions {
  maxConcurrentWaitersPerAccount?: number | undefined;
  maxConcurrentWaiters?: number | undefined;
  retryAfterSeconds?: number | undefined;
}

export type LiveDraftRoomWaitLimitScope = "account" | "global";
