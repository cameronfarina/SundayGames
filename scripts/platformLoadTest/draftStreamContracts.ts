export interface DraftStreamClient {
  readonly roomId: string;
  readonly sessionToken: string;
}

export interface ExpectedDraftEvent {
  readonly event: string;
  readonly revision: number;
  readonly timeoutMs: number;
}
