export type MockDraftSessionErrorCode =
  | "season_active_session_limit"
  | "session_creation_rate_limited"
  | "user_active_session_limit"
  | "access_denied"
  | "command_idempotency_conflict"
  | "session_command_bytes_limit"
  | "session_command_count_limit"
  | "command_key_required"
  | "command_required"
  | "mock_count_required"
  | "owner_required"
  | "session_not_found"
  | "session_not_reusable"
  | "session_not_writable"
  | "stale_command_count"
  | "stale_revision"
  | "team_required";

export class MockDraftSessionError extends Error {
  readonly code: MockDraftSessionErrorCode;
  readonly retryAfterSeconds: number | undefined;

  constructor(code: MockDraftSessionErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.name = "MockDraftSessionError";
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
