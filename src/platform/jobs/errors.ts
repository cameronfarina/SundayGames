export type JobErrorCode =
  | "idempotency_conflict"
  | "idempotency_key_required"
  | "invalid_job_cursor"
  | "job_not_found"
  | "job_owner_required"
  | "job_not_running"
  | "job_already_active"
  | "job_lock_mismatch"
  | "job_not_claimable"
  | "job_not_terminal";

export class JobError extends Error {
  readonly code: JobErrorCode;

  constructor(code: JobErrorCode, message: string) {
    super(message);
    this.name = "JobError";
    this.code = code;
  }
}
