import type { WorkspaceRole } from "../workspacePrivacy.js";
import type { LeagueSetupImportIssue } from "./types.js";

export type LeagueSetupColumn = "owner" | "team" | "email" | "role";

export interface RawLeagueSetupRow {
  rowNumber: number;
  cells: string[];
  blockers: LeagueSetupImportIssue[];
}

export interface DraftLeagueSetupRow {
  rowNumber: number;
  ownerDisplayName: string;
  teamDisplayName: string;
  email?: string;
  role: WorkspaceRole | null;
  rawRole: string;
  blockers: LeagueSetupImportIssue[];
}
