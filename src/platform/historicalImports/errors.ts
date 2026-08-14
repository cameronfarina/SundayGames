export type HistoricalImportErrorCode =
  | "batch_blocked"
  | "batch_not_found"
  | "season_import_conflict";

export class HistoricalImportError extends Error {
  readonly code: HistoricalImportErrorCode;

  constructor(code: HistoricalImportErrorCode, message: string) {
    super(message);
    this.name = "HistoricalImportError";
    this.code = code;
  }
}

export class HistoricalImportTargetError extends Error {
  readonly code: "batch_target_mismatch" = "batch_target_mismatch";

  constructor(message: string) {
    super(message);
    this.name = "HistoricalImportTargetError";
  }
}
