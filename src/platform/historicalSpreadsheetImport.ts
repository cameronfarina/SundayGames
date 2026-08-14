import { Buffer } from "node:buffer";
import { readSheet } from "read-excel-file/node";
import {
  assertHistoricalImportTableDimensions,
  HistoricalImportDocumentLimitError,
} from "./historicalImportLimits.js";
import { assertSafeXlsxArchive } from "./historicalSpreadsheetImport/archive.js";
import {
  HistoricalSpreadsheetUploadError,
  type HistoricalSpreadsheetUploadInput,
  type HistoricalSpreadsheetUploadOptions,
  type HistoricalWorkbookReader,
} from "./historicalSpreadsheetImport/contracts.js";

export { HistoricalSpreadsheetUploadError };
export type {
  HistoricalSpreadsheetUploadInput,
  HistoricalSpreadsheetUploadOptions,
  HistoricalWorkbookReader,
};

const defaultMaxBytes = 5 * 1024 * 1024;
const supportedDelimitedExtensions = new Set(["csv", "tsv"]);

const extensionFor = (fileName: string): string =>
  fileName.trim().toLowerCase().split(".").at(-1) ?? "";

const bytesFor = (base64: string, maxBytes: number): Buffer => {
  const encoded = base64.trim();
  if (encoded.length === 0 || !/^[a-z0-9+/]+={0,2}$/iu.test(encoded)) {
    throw new HistoricalSpreadsheetUploadError("The uploaded draft file is invalid.");
  }
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length === 0) throw new HistoricalSpreadsheetUploadError("The uploaded draft file is empty.");
  if (bytes.length > maxBytes) {
    throw new HistoricalSpreadsheetUploadError(`Draft files must be ${maxBytes} bytes or smaller.`);
  }
  return bytes;
};

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined
    ? ""
    : value instanceof Date
      ? value.toISOString()
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

const rowsToCsv = (rows: readonly (readonly unknown[])[]): string =>
  rows.map(row => row.map(csvCell).join(",")).join("\n");

const defaultWorkbookReader: HistoricalWorkbookReader = async bytes =>
  await readSheet(Buffer.from(bytes));

export const historicalSpreadsheetUploadToSourceText = async (
  input: HistoricalSpreadsheetUploadInput,
  options: HistoricalSpreadsheetUploadOptions = {},
): Promise<string> => {
  const extension = extensionFor(input.fileName);
  if (extension !== "xlsx" && !supportedDelimitedExtensions.has(extension)) {
    throw new HistoricalSpreadsheetUploadError("Choose a CSV, TSV, or XLSX draft file.");
  }
  const bytes = bytesFor(input.base64, options.maxBytes ?? defaultMaxBytes);
  if (extension === "xlsx") {
    if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
      throw new HistoricalSpreadsheetUploadError("The uploaded file is not a valid XLSX workbook.");
    }
    assertSafeXlsxArchive(bytes, options);
    try {
      const rows = await (options.readWorkbook ?? defaultWorkbookReader)(bytes);
      if (rows.length === 0) throw new Error("empty workbook");
      assertHistoricalImportTableDimensions(rows, options);
      return rowsToCsv(rows);
    } catch (error) {
      if (
        error instanceof HistoricalSpreadsheetUploadError ||
        error instanceof HistoricalImportDocumentLimitError
      ) throw error;
      throw new HistoricalSpreadsheetUploadError("The XLSX workbook could not be read.");
    }
  }

  try {
    const sourceText = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    if (sourceText.trim().length === 0) throw new Error("empty file");
    return sourceText;
  } catch {
    throw new HistoricalSpreadsheetUploadError("The draft file must contain UTF-8 text.");
  }
};
