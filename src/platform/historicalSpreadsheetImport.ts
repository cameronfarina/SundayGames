import { Buffer } from "node:buffer";
import { Unzip } from "fflate";
import { readSheet } from "read-excel-file/node";

export interface HistoricalSpreadsheetUploadInput {
  fileName: string;
  mimeType: string;
  base64: string;
}

export type HistoricalWorkbookReader = (
  bytes: Uint8Array,
) => Promise<readonly (readonly unknown[])[]>;

export interface HistoricalSpreadsheetUploadOptions {
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

const defaultMaxBytes = 5 * 1024 * 1024;
const defaultMaxUncompressedBytes = 25 * 1024 * 1024;
const defaultMaxArchiveEntries = 256;
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

const assertSafeXlsxArchive = (
  bytes: Uint8Array,
  maxUncompressedBytes: number,
  maxArchiveEntries: number,
): void => {
  let entryCount = 0;
  let uncompressedBytes = 0;
  let archiveError: HistoricalSpreadsheetUploadError | null = null;
  const archive = new Unzip(file => {
    entryCount += 1;
    if (entryCount > maxArchiveEntries) {
      archiveError = new HistoricalSpreadsheetUploadError(
        `XLSX workbooks may contain at most ${maxArchiveEntries} files.`,
      );
      return;
    }
    if (file.originalSize === undefined || !Number.isSafeInteger(file.originalSize)) {
      archiveError = new HistoricalSpreadsheetUploadError(
        "The XLSX workbook does not declare safe expanded file sizes.",
      );
      return;
    }
    uncompressedBytes += file.originalSize;
    if (uncompressedBytes > maxUncompressedBytes) {
      archiveError = new HistoricalSpreadsheetUploadError(
        `XLSX workbooks must expand to ${maxUncompressedBytes} bytes or fewer.`,
      );
    }
  });

  try {
    archive.push(bytes, true);
  } catch {
    throw new HistoricalSpreadsheetUploadError("The uploaded file is not a valid XLSX workbook.");
  }
  if (archiveError !== null) throw archiveError;
  if (entryCount === 0) {
    throw new HistoricalSpreadsheetUploadError("The uploaded file is not a valid XLSX workbook.");
  }
};

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
    assertSafeXlsxArchive(
      bytes,
      options.maxUncompressedBytes ?? defaultMaxUncompressedBytes,
      options.maxArchiveEntries ?? defaultMaxArchiveEntries,
    );
    try {
      const rows = await (options.readWorkbook ?? defaultWorkbookReader)(bytes);
      if (rows.length === 0) throw new Error("empty workbook");
      return rowsToCsv(rows);
    } catch (error) {
      if (error instanceof HistoricalSpreadsheetUploadError) throw error;
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
