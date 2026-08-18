import type {
  FantasyProsProjectionPosition,
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

export interface SaveFantasyProsRankingsInput {
  rankingType: FantasyProsRankingType;
  scoring: FantasyProsScoring;
  week: number;
  rankings: readonly Omit<FantasyProsStoredRanking, "rankingType" | "scoring" | "week" | "fetchedAt">[];
  fetchedAt: string;
}

export interface SaveFantasyProsProjectionsInput {
  week: number;
  position: FantasyProsProjectionPosition;
  projections: readonly Omit<FantasyProsStoredProjection, "week" | "fetchedAt">[];
  fetchedAt: string;
}

export interface SaveFantasyProsPlayersInput {
  players: readonly Omit<FantasyProsStoredPlayer, "fetchedAt">[];
  fetchedAt: string;
}

export interface FantasyProsRankingsQuery {
  rankingType: FantasyProsRankingType;
  week?: number | undefined;
}

export interface FantasyProsProjectionsQuery {
  week: number;
  position?: string | undefined;
}

export interface ClaimFantasyProsRefreshInput {
  dataset: FantasyProsDataset;
  now: Date;
  cadenceMs: number;
}

export interface RecordFantasyProsRefreshOutcomeInput {
  dataset: FantasyProsDataset;
  now: Date;
  requestCount: number;
  rowCount?: number | undefined;
  error?: string | undefined;
}

export interface FantasyProsDatasetStatus {
  dataset: FantasyProsDataset;
  lastFetchedAt?: string | undefined;
  lastSucceededAt?: string | undefined;
  requestCount: number;
  rowCount: number;
  lastError?: string | undefined;
}

export interface FantasyProsRepository {
  saveRankings(input: SaveFantasyProsRankingsInput): Promise<void>;
  rankings(query: FantasyProsRankingsQuery): Promise<readonly FantasyProsStoredRanking[]>;
  saveProjections(input: SaveFantasyProsProjectionsInput): Promise<void>;
  projections(query: FantasyProsProjectionsQuery): Promise<readonly FantasyProsStoredProjection[]>;
  savePlayers(input: SaveFantasyProsPlayersInput): Promise<void>;
  players(): Promise<readonly FantasyProsStoredPlayer[]>;
  /**
   * Reserves a refresh slot when the stored timestamp is older than the cadence.
   * The comparison happens inside the store so overlapping instances during a
   * zero-downtime deploy cannot both claim the same dataset.
   */
  claimRefresh(input: ClaimFantasyProsRefreshInput): Promise<boolean>;
  recordRefreshOutcome(input: RecordFantasyProsRefreshOutcomeInput): Promise<void>;
  datasetStatuses(): Promise<readonly FantasyProsDatasetStatus[]>;
}
