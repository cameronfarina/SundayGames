import type { WorkspaceRole } from "../workspacePrivacy.js";
import type { LeagueSetupImportIssue } from "./types.js";

export type LeagueSetupColumn = "teamId" | "owner" | "team" | "email" | "role" | "draftOrder";

export interface RawLeagueSetupRow {
  rowNumber: number;
  cells: string[];
  blockers: LeagueSetupImportIssue[];
}

export interface DraftLeagueSetupRow {
  rowNumber: number;
  ownerDisplayName: string;
  teamDisplayName: string;
  existingTeamId?: string;
  email?: string;
  role: WorkspaceRole | null;
  rawRole: string;
  draftOrderPosition?: number;
  rawDraftOrder: string;
  blockers: LeagueSetupImportIssue[];
}
