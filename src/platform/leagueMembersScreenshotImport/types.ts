import type { FantasyTeam } from "../leagueSeason.js";
import type {
  LeagueSetupImportIssueSeverity,
  LeagueSetupImportStatus,
  LeagueSetupTeamRecord,
} from "../leagueSetupImport.js";

export type LeagueMembersScreenshotConfidence = "high" | "medium" | "low";

export type LeagueMembersScreenshotImportIssueCode =
  | "expected_team_count_mismatch"
  | "team_mapping_coverage_mismatch"
  | "duplicate_draft_order_position"
  | "invalid_draft_order_position"
  | "missing_abbreviation"
  | "invalid_abbreviation"
  | "blank_team_name"
  | "truncated_team_name"
  | "blank_manager_name"
  | "duplicate_manager_name"
  | "duplicate_team_name"
  | "missing_team_mapping"
  | "invalid_team_mapping"
  | "duplicate_team_mapping"
  | "review_required";

export interface LeagueMembersScreenshotImportIssue {
  code: LeagueMembersScreenshotImportIssueCode;
  severity: LeagueSetupImportIssueSeverity;
  message: string;
  rowNumber?: number;
}

export interface LeagueMembersScreenshotTeamInput {
  draftOrderPosition: number;
  abbreviation: string;
  teamDisplayName: string;
  managerDisplayNames: readonly string[];
  confidence: LeagueMembersScreenshotConfidence;
  issues: readonly string[];
  confirmed?: boolean;
  targetTeamId?: string | null;
}

export interface LeagueMembersScreenshotImportInput {
  leagueName: string | null;
  externalLeagueId: string | null;
  teams: readonly LeagueMembersScreenshotTeamInput[];
}

export interface LeagueMembersScreenshotImportRow {
  rowNumber: number;
  blockers: readonly LeagueMembersScreenshotImportIssue[];
  record: LeagueSetupTeamRecord | null;
}

export interface LeagueMembersScreenshotImportResult {
  status: LeagueSetupImportStatus;
  leagueName: string | null;
  externalLeagueId: string | null;
  blockers: readonly LeagueMembersScreenshotImportIssue[];
  rows: readonly LeagueMembersScreenshotImportRow[];
  records: readonly LeagueSetupTeamRecord[];
}

export type ExistingScreenshotTeam = Pick<
  FantasyTeam,
  "id" | "ownerDisplayName" | "displayName" | "abbreviation"
>;

export interface ValidateLeagueMembersScreenshotImportOptions {
  expectedTeamCount: number;
  existingTeams?: readonly ExistingScreenshotTeam[];
  requireTeamMappings?: boolean;
}
