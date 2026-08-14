import type { SnakeDraftCommand } from "./command.js";
import type { SnakeDraftConfig, SnakeDraftOrderType } from "./config.js";

export type SnakeDraftStatus = "setup" | "active" | "completed";

export interface SnakeDraftPickRef {
  overall: number;
  round: number;
  pickInRound: number;
  teamId: string;
}

export interface SnakeDraftSelection {
  playerId: string;
  source: "ai" | "human" | "keeper";
  rosterSlot: string;
}

export interface SnakeDraftBoardPick extends SnakeDraftPickRef {
  teamName: string;
  selection: SnakeDraftSelection | undefined;
}

export interface SnakeDraftBoardPlayer {
  id: string;
  name: string;
  position: string;
  rank: number;
  adp: number;
  leagueExpectedPick: number;
  personalRank: number | undefined;
  reachLimit: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
  available: boolean;
}

export interface SnakeDraftTeamRosterSlot {
  slot: string;
  eligiblePositions: readonly string[];
  playerId: string | undefined;
}

export interface SnakeDraftTeamReadModel {
  id: string;
  name: string;
  roster: readonly SnakeDraftSelection[];
  slots: readonly SnakeDraftTeamRosterSlot[];
}

export interface SnakeDraftSessionReadModel {
  id: string;
  status: SnakeDraftStatus;
  revision: number;
  seed: string;
  rounds: number;
  orderType: SnakeDraftOrderType;
  teamOrder: readonly string[];
  humanTeamId: string;
  currentPick: SnakeDraftPickRef | undefined;
  canUndo: boolean;
  canComplete: boolean;
  commandLog: readonly SnakeDraftCommand[];
}

export interface SnakeDraftBoardReadModel {
  picks: readonly SnakeDraftBoardPick[];
  players: readonly SnakeDraftBoardPlayer[];
}

export interface SnakeDraftState {
  session: SnakeDraftSessionReadModel;
  board: SnakeDraftBoardReadModel;
  teams: readonly SnakeDraftTeamReadModel[];
  readonly configuration: SnakeDraftConfig;
}
