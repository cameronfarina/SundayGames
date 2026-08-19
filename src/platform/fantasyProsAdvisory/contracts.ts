import type { Position } from "../../../config/league.js";
import type { FantasyProsStoredRanking } from "../fantasyPros.js";

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

export interface FantasyProsAdvisoryPlayer {
  normalizedPlayerName: string;
  rankEcr: number;
  tier?: number | undefined;
  positionRank?: string | undefined;
  momentum: FantasyProsRankMomentum;
  ecrDelta?: number | undefined;
}

export interface BuildFantasyProsDraftAdvisoryInput {
  basis: FantasyProsAdvisoryBasis;
  rankings: readonly FantasyProsStoredRanking[];
  candidates: readonly FantasyProsAdvisoryCandidate[];
}

export interface FantasyProsDraftAdvisory {
  basis: FantasyProsAdvisoryBasis;
  week?: number | undefined;
  players: readonly FantasyProsAdvisoryPlayer[];
}
