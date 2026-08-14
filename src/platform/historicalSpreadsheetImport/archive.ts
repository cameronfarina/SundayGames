import { Unzip } from "fflate";
import {
  HistoricalSpreadsheetUploadError,
  type HistoricalSpreadsheetUploadOptions,
} from "./contracts.js";

const defaultMaxUncompressedBytes = 25 * 1024 * 1024;
const defaultMaxArchiveEntries = 256;

export const assertSafeXlsxArchive = (
  bytes: Uint8Array,
  options: HistoricalSpreadsheetUploadOptions,
): void => {
  const maxUncompressedBytes = options.maxUncompressedBytes ?? defaultMaxUncompressedBytes;
  const maxArchiveEntries = options.maxArchiveEntries ?? defaultMaxArchiveEntries;
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
