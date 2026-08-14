import type {
  HistoricalImportBatch,
  HistoricalImportIdentityAudit,
  HistoricalImportRowPreview,
} from "./batchContracts.js";
import { historicalImportIssue } from "./issues.js";
import type { NormalizedHistoricalImportRow } from "./playerContracts.js";

export interface BlockedBatchIdentity {
  id: string;
  leagueId: string;
  leagueSeasonId: string | null;
  seasonYear: number;
  fileHash: string;
  uploadedByUserId?: string;
  replacementRequested: boolean;
  createdAt: Date;
}

const unresolvedIdentityAudit = (
  row: NormalizedHistoricalImportRow,
): HistoricalImportIdentityAudit => ({
  sourceOwnerOrTeamLabel: row.ownerDisplayName?.trim() ?? "",
  resolution: "unresolved",
});

const blockedRows = (
  rows: readonly NormalizedHistoricalImportRow[],
): HistoricalImportRowPreview[] =>
  rows.map(row => ({
    rowNumber: row.sourceRowNumber,
    status: "blocked",
    blockers: [],
    warnings: [],
    record: null,
    identityAudit: unresolvedIdentityAudit(row),
  }));

export const missingSeasonBatch = (
  identity: BlockedBatchIdentity,
  rows: readonly NormalizedHistoricalImportRow[],
  message: string,
): HistoricalImportBatch => ({
  ...identity,
  leagueSeasonId: null,
  status: "blocked",
  blockers: [historicalImportIssue("season_missing", "blocker", message)],
  warnings: [],
  rows: blockedRows(rows),
});

export const teamCountMismatchBatch = (
  identity: BlockedBatchIdentity,
  rows: readonly NormalizedHistoricalImportRow[],
  actualTeams: number,
  expectedTeams: number,
): HistoricalImportBatch => ({
  ...identity,
  status: "blocked",
  blockers: [historicalImportIssue(
    "team_count_mismatch",
    "blocker",
    `This draft file contains ${actualTeams} teams, but the current league has ${expectedTeams} teams.`,
  )],
  warnings: [],
  rows: blockedRows(rows),
});
