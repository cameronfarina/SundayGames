import type { LeagueSeason } from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../platformApp.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";

export type LeagueSetupImportStatus = "ready" | "blocked";
export type LeagueSetupImportRowStatus = "ready" | "blocked";
export type LeagueSetupImportIssueSeverity = "blocker";

export type LeagueSetupImportIssueCode =
  | "expected_team_count_mismatch"
  | "malformed_row"
  | "blank_owner"
  | "duplicate_owner_name"
  | "duplicate_team_name"
  | "invalid_role"
  | "invalid_draft_order"
  | "duplicate_draft_order";

export interface LeagueSetupImportIssue {
  code: LeagueSetupImportIssueCode;
  severity: LeagueSetupImportIssueSeverity;
  message: string;
  rowNumber?: number;
}

export interface LeagueSetupTeamRecord {
  sourceRowNumber: number;
  ownerDisplayName: string;
  managerDisplayNames?: readonly string[];
  abbreviation?: string;
  draftOrderPosition?: number;
  existingTeamId?: string;
  teamDisplayName: string;
  email?: string;
  role: WorkspaceRole;
}

export interface LeagueSetupImportRowPreview {
  rowNumber: number;
  status: LeagueSetupImportRowStatus;
  blockers: LeagueSetupImportIssue[];
  record: LeagueSetupTeamRecord | null;
}

export interface LeagueSetupImportResult {
  status: LeagueSetupImportStatus;
  blockers: LeagueSetupImportIssue[];
  rows: LeagueSetupImportRowPreview[];
  records: LeagueSetupTeamRecord[];
}

export interface ParseLeagueSetupImportOptions {
  expectedTeamCount?: number;
}

export interface LeagueSetupMembershipSeed
  extends Pick<PlatformLeagueMembership, "leagueId" | "role"> {
  ownerId: string;
  teamId: string;
  ownerDisplayName: string;
  teamDisplayName: string;
  email?: string;
}

export interface AppliedLeagueSetupImport {
  season: LeagueSeason;
  memberships: LeagueSetupMembershipSeed[];
}
