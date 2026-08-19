import type { Position } from "../../../config/league.js";

export interface FantasyProsRankView {
  rankEcr: number;
  positionRank?: string | undefined;
  tier?: number | undefined;
  rankMin?: number | undefined;
  rankMax?: number | undefined;
  rankStandardDeviation?: number | undefined;
  ecrDelta?: number | undefined;
}

export interface FantasyProsInSeasonPlayer {
  playerId: string;
  playerName: string;
  position: Position;
  teamAbbreviation?: string | undefined;
  byeWeek?: number | undefined;
  fantasyProsPlayerId?: number | undefined;
  weekly?: FantasyProsRankView | undefined;
  restOfSeason?: FantasyProsRankView | undefined;
  weeklyProjectedPoints?: number | undefined;
  restOfSeasonProjectedPoints?: number | undefined;
}

/** Which projection the lineup was assigned on; the two are never mixed. */
export type FantasyProsLineupBasis = "weekly_projection" | "rest_of_season_projection";

/** The independent rank the bench alternative is judged against. */
export type FantasyProsConcernBasis = "weekly_ecr" | "rest_of_season_rank";

export interface FantasyProsLineupConcern {
  basis: FantasyProsConcernBasis;
  rankGap: number;
  message: string;
}

export interface FantasyProsLineupSlot {
  slot: string;
  eligiblePositions: readonly Position[];
  start: FantasyProsInSeasonPlayer;
  bench?: FantasyProsInSeasonPlayer | undefined;
  pointEdge?: number | undefined;
  concern?: FantasyProsLineupConcern | undefined;
}

export interface FantasyProsLineup {
  basis: FantasyProsLineupBasis;
  slots: readonly FantasyProsLineupSlot[];
}

/**
 * Waiver rankings return no rows until the season starts, so the pre-season
 * view falls back to rest-of-season rankings for widely unowned players.
 */
export type FantasyProsWaiverSource = "waiver_rankings" | "widely_available";

export interface FantasyProsWaiverPlayer extends FantasyProsInSeasonPlayer {
  waiverRank?: number | undefined;
  ownedEspn?: number | undefined;
}

export interface FantasyProsWaiverBoard {
  source: FantasyProsWaiverSource;
  ownershipThreshold?: number | undefined;
  players: readonly FantasyProsWaiverPlayer[];
}

export interface FantasyProsInSeasonView {
  configured: boolean;
  week?: number | undefined;
  updatedAt?: string | undefined;
  players: readonly FantasyProsInSeasonPlayer[];
  lineup?: FantasyProsLineup | undefined;
  waivers: FantasyProsWaiverBoard;
}
