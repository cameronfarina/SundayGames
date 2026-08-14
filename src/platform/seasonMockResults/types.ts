import type { GenericAuctionMockState } from "../genericAuctionMockEngine.js";
import type { SnakeDraftState } from "../snakeDraftEngine.js";

export interface SeasonMockResultPlayer {
  playerId: string;
  playerName: string;
  position: string;
  rosterSlot: string;
  week1Points: number;
  starter: boolean;
  source: "keeper" | "human" | "ai";
  price?: number | undefined;
  overallPick?: number | undefined;
}

export interface SeasonMockResultTeam {
  teamId: string;
  teamName: string;
  rank: number;
  isUserTeam: boolean;
  week1Points: number;
  spent?: number | undefined;
  budgetRemaining?: number | undefined;
  roster: readonly SeasonMockResultPlayer[];
}

export interface SeasonMockResults {
  teams: readonly SeasonMockResultTeam[];
  projectedPlayerCount: number;
  rosteredPlayerCount: number;
}

export interface ResultBoardPlayer {
  id: string;
  name: string;
  position: string;
  week1Projection?: number | undefined;
}

export interface ResultCandidate {
  playerId: string;
  position: string;
  week1Points: number;
}

export interface ResultAcquisition {
  playerId: string;
  source: "keeper" | "human" | "ai";
  price?: number;
  overallPick?: number;
}

export interface ResultTeamInput {
  id: string;
  name: string;
  slots: readonly ResultSlotInput[];
  acquisitions: readonly ResultAcquisition[];
  spent?: number;
  budgetRemaining?: number;
}

export interface ResultSlotInput {
  slot: string;
  eligiblePositions: readonly string[];
}

export interface ResultSlot extends ResultSlotInput {
  originalIndex: number;
}

export interface LineupAssignment {
  slot: string;
  playerId: string;
}

export interface LineupChoice {
  score: number;
  assignments: readonly LineupAssignment[];
}

export interface ScoredResultTeam {
  team: SeasonMockResultTeam;
  projectedPlayerCount: number;
  rosteredPlayerCount: number;
}

export type SeasonMockState = SnakeDraftState | GenericAuctionMockState;
