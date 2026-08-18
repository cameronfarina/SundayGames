import type { Position } from "../../../config/league.js";
import type {
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
} from "../fantasyPros.js";

export interface FantasyProsMatchCandidate {
  name: string;
  position: Position;
  teamAbbreviation?: string | undefined;
}

export interface FantasyProsMatch {
  playerId: number;
  playerName: string;
  position: string;
  teamAbbreviation?: string | undefined;
  ranking?: FantasyProsStoredRanking | undefined;
  projection?: FantasyProsStoredProjection | undefined;
}

export interface BuildFantasyProsPlayerIndexInput {
  players: readonly FantasyProsStoredPlayer[];
  rankings?: readonly FantasyProsStoredRanking[] | undefined;
  projections?: readonly FantasyProsStoredProjection[] | undefined;
}

export interface FantasyProsPlayerIndex {
  find(candidate: FantasyProsMatchCandidate): FantasyProsMatch | undefined;
}
