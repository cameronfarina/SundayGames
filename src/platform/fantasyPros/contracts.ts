import type {
  FantasyProsProjectionPosition,
  FantasyProsRankingType,
  FantasyProsScoring,
} from "../../data/fantasyPros.js";
import type {
  FantasyProsDataset,
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
} from "./records.js";

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
  /**
   * When set alongside an error, rewinds the stored timestamp so the dataset
   * becomes claimable again after this delay instead of after a full cadence.
   */
  retryDelayMs?: number | undefined;
  cadenceMs?: number | undefined;
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
  /** Resolves the handful of players a news pull mentions without loading 8,500 rows. */
  playersByIds(playerIds: readonly number[]): Promise<readonly FantasyProsStoredPlayer[]>;
  /**
   * Reserves a refresh slot when the stored timestamp is older than the cadence.
   * The comparison happens inside the store so overlapping instances during a
   * zero-downtime deploy cannot both claim the same dataset.
   */
  claimRefresh(input: ClaimFantasyProsRefreshInput): Promise<boolean>;
  recordRefreshOutcome(input: RecordFantasyProsRefreshOutcomeInput): Promise<void>;
  datasetStatuses(): Promise<readonly FantasyProsDatasetStatus[]>;
}
