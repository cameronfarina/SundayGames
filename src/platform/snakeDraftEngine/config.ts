export type SnakeDraftOrderType = "standard" | "third_round_reversal";

export interface SnakeDraftOwnerTendency {
  rankWeight?: number | undefined;
  adpWeight?: number | undefined;
  rosterNeedWeight?: number | undefined;
  positionalRunWeight?: number | undefined;
  positionPreferences?: Readonly<Record<string, number>> | undefined;
}

export interface SnakeDraftTeamConfig {
  id: string;
  name: string;
  aiTendency?: SnakeDraftOwnerTendency | undefined;
}

export interface SnakeDraftRosterSlotConfig {
  slot: string;
  count: number;
  eligiblePositions: readonly string[];
}

export interface SnakeDraftPlayer {
  id: string;
  name: string;
  position: string;
  rank: number;
  adp: number;
  leagueExpectedPick?: number | undefined;
  personalRank?: number | undefined;
  reachLimit?: number | undefined;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  week1Projection?: number | undefined;
}

export interface SnakeDraftKeeperPlacement {
  teamId: string;
  playerId: string;
  round: number;
  pickInRound: number;
}

export interface SnakeDraftAiConfig {
  rankWeight?: number | undefined;
  adpWeight?: number | undefined;
  rosterNeedWeight?: number | undefined;
  positionalRunWeight?: number | undefined;
  positionalRunWindow?: number | undefined;
  randomWeight?: number | undefined;
}

export interface SnakeDraftConfig {
  sessionId: string;
  seed: string;
  rounds: number;
  orderType: SnakeDraftOrderType;
  teamOrder: readonly string[];
  humanTeamId: string;
  teams: readonly SnakeDraftTeamConfig[];
  rosterSlots: readonly SnakeDraftRosterSlotConfig[];
  players: readonly SnakeDraftPlayer[];
  keepers?: readonly SnakeDraftKeeperPlacement[] | undefined;
  ai?: SnakeDraftAiConfig | undefined;
}
