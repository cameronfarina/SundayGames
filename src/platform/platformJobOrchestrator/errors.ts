export type PlatformJobOrchestratorErrorCode =
  | "invalid_payload"
  | "missing_handler"
  | "unknown_job_type";

export class PlatformJobOrchestratorError extends Error {
  readonly code: PlatformJobOrchestratorErrorCode;

  constructor(code: PlatformJobOrchestratorErrorCode, message: string) {
    super(message);
    this.name = "PlatformJobOrchestratorError";
    this.code = code;
  }
}
