import type {
  FantasyProsRankingType,
  FantasyProsScoring,
} from "../../data/fantasyPros.js";
import type {
  FantasyProsDataset,
  FantasyProsDatasetStatus,
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
} from "../fantasyPros.js";
import { fantasyProsDatasets } from "../fantasyPros.js";
import type {
  FantasyProsFetchLogRow,
  FantasyProsPlayerRow,
  FantasyProsProjectionRow,
  FantasyProsRankingRow,
} from "./contracts.js";

const isoStringFrom = (value: Date | string): string =>
  typeof value === "string" ? value : value.toISOString();

// Postgres returns numeric columns as strings to preserve precision.
const numberFromDb = (value: string | number | null): number | undefined => {
  if (value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const countFromDb = (value: string | number): number => numberFromDb(value) ?? 0;

const textFromDb = (value: string | null): string | undefined => value ?? undefined;

const rankingTypeFromDb = (value: string): FantasyProsRankingType =>
  value === "weekly" || value === "waiver" ? value : "ros";

const scoringFromDb = (value: string): FantasyProsScoring =>
  value === "HALF" || value === "STD" ? value : "PPR";

const positionsFromDb = (value: unknown): readonly string[] => {
  const parsed: unknown = typeof value === "string" ? JSON.parse(value) : value;
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
};

const datasetFromDb = (value: string): FantasyProsDataset | undefined =>
  fantasyProsDatasets.find(candidate => candidate === value);

export const rankingFromRow = (row: FantasyProsRankingRow): FantasyProsStoredRanking => ({
  rankingType: rankingTypeFromDb(row.ranking_type),
  scoring: scoringFromDb(row.scoring),
  week: row.week,
  playerId: row.player_id,
  playerName: row.player_name,
  position: row.player_position,
  teamAbbreviation: textFromDb(row.player_team),
  yahooId: textFromDb(row.yahoo_id),
  rankEcr: row.rank_ecr,
  rankMin: row.rank_min ?? undefined,
  rankMax: row.rank_max ?? undefined,
  rankAverage: numberFromDb(row.rank_average),
  rankStandardDeviation: numberFromDb(row.rank_standard_deviation),
  tier: row.tier ?? undefined,
  positionRank: textFromDb(row.position_rank),
  byeWeek: row.bye_week ?? undefined,
  ecrDelta: numberFromDb(row.ecr_delta),
  ownedAverage: numberFromDb(row.owned_average),
  ownedEspn: numberFromDb(row.owned_espn),
  ownedYahoo: numberFromDb(row.owned_yahoo),
  fetchedAt: isoStringFrom(row.fetched_at),
});

export const projectionFromRow = (
  row: FantasyProsProjectionRow,
): FantasyProsStoredProjection => ({
  week: row.week,
  playerId: row.player_id,
  playerName: row.player_name,
  position: row.player_position,
  teamAbbreviation: textFromDb(row.player_team),
  points: numberFromDb(row.points),
  pointsPpr: numberFromDb(row.points_ppr),
  passingYards: numberFromDb(row.passing_yards),
  passingTouchdowns: numberFromDb(row.passing_touchdowns),
  interceptions: numberFromDb(row.interceptions),
  rushingYards: numberFromDb(row.rushing_yards),
  rushingTouchdowns: numberFromDb(row.rushing_touchdowns),
  receptions: numberFromDb(row.receptions),
  receivingYards: numberFromDb(row.receiving_yards),
  receivingTouchdowns: numberFromDb(row.receiving_touchdowns),
  fetchedAt: isoStringFrom(row.fetched_at),
});

export const playerFromRow = (row: FantasyProsPlayerRow): FantasyProsStoredPlayer => ({
  playerId: row.player_id,
  playerName: row.player_name,
  firstName: textFromDb(row.first_name),
  lastName: textFromDb(row.last_name),
  shortName: textFromDb(row.short_name),
  position: row.player_position,
  positions: positionsFromDb(row.positions_json),
  teamAbbreviation: textFromDb(row.player_team),
  sportsDataId: textFromDb(row.sportsdata_id),
  fetchedAt: isoStringFrom(row.fetched_at),
});

export const datasetStatusFromRow = (
  row: FantasyProsFetchLogRow,
): FantasyProsDatasetStatus | undefined => {
  const dataset = datasetFromDb(row.dataset);
  if (dataset === undefined) return undefined;
  return {
    dataset,
    lastFetchedAt: isoStringFrom(row.last_fetched_at),
    lastSucceededAt: row.last_succeeded_at === null
      ? undefined
      : isoStringFrom(row.last_succeeded_at),
    requestCount: countFromDb(row.request_count),
    rowCount: countFromDb(row.row_count),
    lastError: textFromDb(row.last_error),
  };
};
