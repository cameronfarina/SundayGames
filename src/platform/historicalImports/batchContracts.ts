import type { LeagueSeason } from "../leagueSeason.js";
import type { HistoricalImportIssue } from "./issueContracts.js";
import type { HistoricalOwnerResolutionCandidate } from "./playerContracts.js";
import type { HistoricalSaleRecord } from "./saleContracts.js";

export type HistoricalImportBatchStatus = "previewed" | "blocked" | "committed" | "superseded";
export type HistoricalImportRowStatus = "ready" | "blocked";

export interface HistoricalOwnerMapping {
  sourceOwnerOrTeamLabel: string;
  teamId: string;
}

export interface HistoricalImportIdentityAudit {
  sourceOwnerOrTeamLabel: string;
  resolution: "exact" | "explicit" | "fuzzy" | "ambiguous" | "unresolved";
  mappedTeamId?: string;
  mappedCurrentOwnerDisplayName?: string;
  mappedCurrentTeamDisplayName?: string;
  candidates?: readonly HistoricalOwnerResolutionCandidate[];
}

export interface HistoricalImportRowPreview {
  rowNumber: number;
  status: HistoricalImportRowStatus;
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
  record: HistoricalSaleRecord | null;
  identityAudit?: HistoricalImportIdentityAudit;
}

export interface HistoricalImportBatch {
  id: string;
  leagueId: string;
  leagueSeasonId: string | null;
  seasonYear: number;
  fileHash: string;
  uploadedByUserId?: string;
  status: HistoricalImportBatchStatus;
  replacementRequested: boolean;
  createdAt: Date;
  committedAt?: Date;
  supersededAt?: Date;
  supersededByBatchId?: string;
  blockers: HistoricalImportIssue[];
  warnings: HistoricalImportIssue[];
  rows: HistoricalImportRowPreview[];
}

export interface HistoricalImportSeasonContext {
  currentLeagueSeason: LeagueSeason;
}
