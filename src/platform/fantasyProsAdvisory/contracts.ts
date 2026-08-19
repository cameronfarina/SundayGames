import type { Position } from "../../../config/league.js";
import type { FantasyProsStoredRanking } from "../fantasyPros.js";
import type { FantasyProsPlayerNewsIndex } from "../fantasyProsInSeason.js";

/**
 * Which ranking set the advisory was built from. Weekly rankings cover only the
 * flex positions, so a draft room reads rest-of-season and says so.
 */
export type FantasyProsAdvisoryBasis = "ros" | "weekly";

export type FantasyProsRankMomentum = "rising" | "falling" | "steady";

export interface FantasyProsAdvisoryCandidate {
  name: string;
  normalizedPlayerName: string;
  position: Position;
  teamAbbreviation?: string | undefined;
}

/**
 * The newest FantasyPros report about a player, carried only when FantasyPros
 * filed it under its Injury category. A draft board is read a row at a time
 * under a bid clock, so the advisory reports the one kind of news that changes
 * what a player is worth rather than everything published about him.
 */
export interface FantasyProsAdvisoryInjury {
  headline: string;
  publishedAt: string;
}

export interface FantasyProsAdvisoryPlayer {
  normalizedPlayerName: string;
  rankEcr: number;
  tier?: number | undefined;
  positionRank?: string | undefined;
  momentum: FantasyProsRankMomentum;
  ecrDelta?: number | undefined;
  injury?: FantasyProsAdvisoryInjury | undefined;
}

export interface BuildFantasyProsDraftAdvisoryInput {
  basis: FantasyProsAdvisoryBasis;
  rankings: readonly FantasyProsStoredRanking[];
  candidates: readonly FantasyProsAdvisoryCandidate[];
  news?: FantasyProsPlayerNewsIndex | undefined;
}

export interface FantasyProsDraftAdvisory {
  basis: FantasyProsAdvisoryBasis;
  week?: number | undefined;
  players: readonly FantasyProsAdvisoryPlayer[];
}
