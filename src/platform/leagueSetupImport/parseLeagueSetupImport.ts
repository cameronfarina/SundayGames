import { draftRowFor } from "./draftRow.js";
import { headerMapFor } from "./headerMap.js";
import { createImportIssue } from "./importIssue.js";
import { parseRawRows } from "./rawRows.js";
import { addDuplicateBlockers, addRowValidationBlockers } from "./rowValidation.js";
import { rowPreviewFor } from "./rowPreview.js";
import type {
  LeagueSetupImportResult,
  LeagueSetupTeamRecord,
  ParseLeagueSetupImportOptions,
} from "./types.js";

const readyRecords = (
  rows: LeagueSetupImportResult["rows"],
): LeagueSetupTeamRecord[] => rows.flatMap(row => row.record === null ? [] : [row.record]);

export const parseLeagueSetupImport = (
  content: string,
  options: ParseLeagueSetupImportOptions = {},
): LeagueSetupImportResult => {
  const rawRows = parseRawRows(content);
  const headerMap = headerMapFor(rawRows[0]);
  const dataRows = headerMap === null ? rawRows : rawRows.slice(1);
  const drafts = dataRows.map(row => draftRowFor(row, headerMap));
  const countBlockers = options.expectedTeamCount === undefined
    || dataRows.length === options.expectedTeamCount
    ? []
    : [
        createImportIssue(
          "expected_team_count_mismatch",
          `Expected ${options.expectedTeamCount} teams, but found ${dataRows.length}.`,
        ),
      ];
  const blockers = [
    ...countBlockers,
    ...dataRows.flatMap(row => row.blockers),
    ...addDuplicateBlockers(drafts, "ownerDisplayName", "duplicate_owner_name", "Owner"),
    ...addDuplicateBlockers(drafts, "teamDisplayName", "duplicate_team_name", "Team"),
    ...addRowValidationBlockers(drafts),
  ];
  const status = blockers.length === 0 ? "ready" : "blocked";
  const rows = drafts.map(rowPreviewFor);
  const records = readyRecords(rows);

  return {
    status,
    blockers,
    rows,
    records: status === "ready" ? records : [],
  };
};
