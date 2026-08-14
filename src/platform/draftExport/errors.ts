import type { DraftExportErrorCode } from "./contracts.js";

export class DraftExportError extends Error {
  constructor(
    readonly code: DraftExportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "DraftExportError";
  }
}
