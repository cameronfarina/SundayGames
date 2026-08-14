import type {
  HistoricalImportSourceWarning,
  HistoricalImportSourceWarningCode,
} from "./contracts.js";

export const sourceWarning = (
  code: HistoricalImportSourceWarningCode,
  message: string,
  rowNumber?: number,
  column?: string,
): HistoricalImportSourceWarning => ({
  code,
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
  ...(column === undefined ? {} : { column }),
});
