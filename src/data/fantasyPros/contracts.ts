import type {
  FantasyProsNewsItem,
  FantasyProsNewsRequest,
} from "./newsContracts.js";

export type FantasyProsRankingType = "weekly" | "ros" | "waiver";
export type FantasyProsScoring = "PPR" | "HALF" | "STD";
export type FantasyProsProjectionPosition = "QB" | "RB" | "WR" | "TE" | "K" | "DST";

export const fantasyProsRankingTypes: readonly FantasyProsRankingType[] = [
  "weekly",
  "ros",
  "waiver",
];

export const fantasyProsProjectionPositions: readonly FantasyProsProjectionPosition[] = [
  "QB",
  "RB",
  "WR",
  "TE",
  "K",
  "DST",
];

export interface FantasyProsRanking {
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
}

export interface FantasyProsRankingSet {
  type: FantasyProsRankingType;
  scoring: FantasyProsScoring;
  week: number;
  rankings: readonly FantasyProsRanking[];
}

export interface FantasyProsProjection {
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
}

export interface FantasyProsProjectionSet {
  position: FantasyProsProjectionPosition;
  week: number;
  projections: readonly FantasyProsProjection[];
}

export interface FantasyProsPlayer {
  playerId: number;
  playerName: string;
  firstName?: string | undefined;
  lastName?: string | undefined;
  shortName?: string | undefined;
  position: string;
  positions: readonly string[];
  teamAbbreviation?: string | undefined;
  sportsDataId?: string | undefined;
}

/** The client only ever requests a string URL, so that is all it asks for. */
export type FantasyProsFetch = (url: string, init: RequestInit) => Promise<Response>;

export interface FantasyProsClientOptions {
  apiKey: string;
  baseUrl?: string | undefined;
  season?: number | undefined;
  timeoutMs?: number | undefined;
  fetchImplementation?: FantasyProsFetch | undefined;
}

export interface FantasyProsRankingsRequest {
  type: FantasyProsRankingType;
  week?: number | undefined;
  scoring?: FantasyProsScoring | undefined;
}

export interface FantasyProsProjectionsRequest {
  position: FantasyProsProjectionPosition;
  week: number;
  scoring?: FantasyProsScoring | undefined;
}

export interface FantasyProsClient {
  fetchRankings(request: FantasyProsRankingsRequest): Promise<FantasyProsRankingSet>;
  fetchProjections(request: FantasyProsProjectionsRequest): Promise<FantasyProsProjectionSet>;
  fetchPlayers(): Promise<readonly FantasyProsPlayer[]>;
  fetchNews(request?: FantasyProsNewsRequest): Promise<readonly FantasyProsNewsItem[]>;
}
