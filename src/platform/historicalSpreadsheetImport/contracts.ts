import type { HistoricalImportDocumentLimits } from "../historicalImportLimits.js";

export interface HistoricalSpreadsheetUploadInput {
  fileName: string;
  mimeType: string;
  base64: string;
}

export type HistoricalWorkbookReader = (
  bytes: Uint8Array,
) => Promise<readonly (readonly unknown[])[]>;

export interface HistoricalSpreadsheetUploadOptions extends HistoricalImportDocumentLimits {
  maxBytes?: number;
  maxUncompressedBytes?: number;
  maxArchiveEntries?: number;
  readWorkbook?: HistoricalWorkbookReader;
}

export class HistoricalSpreadsheetUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HistoricalSpreadsheetUploadError";
  }
}
