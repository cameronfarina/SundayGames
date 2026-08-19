import type {
  FantasyProsRankingType,
  FantasyProsScoring,
} from "../../data/fantasyPros.js";

export type FantasyProsDataset =
  | "rankings-weekly"
  | "rankings-ros"
  | "rankings-waiver"
  | "projections-weekly"
  | "projections-ros"
  | "players";

export const fantasyProsDatasets: readonly FantasyProsDataset[] = [
  "rankings-weekly",
  "rankings-ros",
  "rankings-waiver",
  "projections-weekly",
  "projections-ros",
  "players",
];

export interface FantasyProsStoredRanking {
  rankingType: FantasyProsRankingType;
  scoring: FantasyProsScoring;
  week: number;
  playerId: number;
  playerName: string;
  position: string;
  teamAbbreviation?: string | undefined;
  yahooId?: string | undefined;
  rankEcr: number;
  rankMin?: number | undefined;
  rankMax?: number | undefined;
  rankAverage?: number | undefined;
  rankStandardDeviation?: number | undefined;
  tier?: number | undefined;
  positionRank?: string | undefined;
  byeWeek?: number | undefined;
  ecrDelta?: number | undefined;
  ownedAverage?: number | undefined;
  ownedEspn?: number | undefined;
  ownedYahoo?: number | undefined;
  fetchedAt: string;
}

export interface FantasyProsStoredProjection {
  week: number;
  playerId: number;
  playerName: string;
  position: string;
  teamAbbreviation?: string | undefined;
  points?: number | undefined;
  pointsPpr?: number | undefined;
  passingYards?: number | undefined;
  passingTouchdowns?: number | undefined;
  interceptions?: number | undefined;
  rushingYards?: number | undefined;
  rushingTouchdowns?: number | undefined;
  receptions?: number | undefined;
  receivingYards?: number | undefined;
  receivingTouchdowns?: number | undefined;
  fetchedAt: string;
}

export interface FantasyProsStoredPlayer {
  playerId: number;
  playerName: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  shortName?: string | undefined;
  position: string;
  positions: readonly string[];
  teamAbbreviation?: string | undefined;
  sportsDataId?: string | undefined;
  fetchedAt: string;
}
