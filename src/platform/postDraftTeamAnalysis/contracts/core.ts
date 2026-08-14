import type { Position } from "../../../../config/league.js";

export type PostDraftFormat = "auction" | "snake";
export type TeamAnalysisComponent = "starterProjection" | "benchDepth" | "positionalBalance";
export type RosterStrengthCode = "balanced_positions" | "deep_bench" | "strong_starters";
export type RosterRiskCode =
  | "positional_imbalance"
  | "starter_slots_unfilled"
  | "thin_bench"
  | "weak_starters";

export interface MyTeamOwnershipContext {
  userId: string;
  privateOwnerUserId: string;
  leagueId: string;
  seasonId: string;
  teamId: string;
  ownerId: string;
}

export interface PostDraftRosterPlayer {
  playerId: string;
  playerName: string;
  position: Position;
}

export interface PostDraftTeamRoster {
  teamId: string;
  ownerId: string;
  players: readonly PostDraftRosterPlayer[];
}

export interface CompletedDraftRosterSnapshot {
  snapshotId: string;
  leagueId: string;
  seasonId: string;
  capturedAt: string;
  status: "complete";
  draftFormat: PostDraftFormat;
  teams: readonly PostDraftTeamRoster[];
}

export interface PostDraftScoringSettings {
  id: string;
  rules: Readonly<Record<string, number>>;
}

export interface PostDraftStarterSlot {
  slot: string;
  eligiblePositions: readonly Position[];
}

export interface PostDraftRosterSettings {
  rosterSize: number;
  starterSlots: readonly PostDraftStarterSlot[];
}

export interface PostDraftLeagueSettings {
  leagueId: string;
  seasonId: string;
  scoring: PostDraftScoringSettings;
  roster: PostDraftRosterSettings;
}
