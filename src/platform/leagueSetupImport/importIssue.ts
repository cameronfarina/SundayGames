import type {
  LeagueSetupImportIssue,
  LeagueSetupImportIssueCode,
} from "./types.js";

export const createImportIssue = (
  code: LeagueSetupImportIssueCode,
  message: string,
  rowNumber?: number,
): LeagueSetupImportIssue => ({
  code,
  severity: "blocker",
  message,
  ...(rowNumber === undefined ? {} : { rowNumber }),
});
