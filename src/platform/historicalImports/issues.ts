import type {
  HistoricalImportIssue,
  HistoricalImportIssueCode,
  HistoricalImportIssueSeverity,
} from "./issueContracts.js";

export const historicalImportIssue = (
  code: HistoricalImportIssueCode,
  severity: HistoricalImportIssueSeverity,
  message: string,
  rowNumber?: number,
  details: Pick<HistoricalImportIssue, "sourceValue" | "candidates"> = {},
): HistoricalImportIssue => ({
  code,
  severity,
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
  ...details,
});
