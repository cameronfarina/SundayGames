import type { Owner, Position } from "../../../config/league.js";

export type PositionAmounts = Record<Position, number>;
export type OwnerAmounts = Record<Owner, number>;
export type HistoricalBacktestMethod = "leave-one-season-out";
export type HistoricalBacktestGateStatus = "pass" | "warn" | "fail";
export type HistoricalBacktestGateCategory =
  | "open_auction_spend"
  | "auction_player_count"
  | "high_price_volume"
  | "price_tier_count"
  | "position_count"
  | "position_spend"
  | "owner_spend";

export interface HistoricalPriceTier {
  key: "elite" | "strong" | "starter" | "depth" | "dollar";
  label: string;
  minPrice: number;
  maxPrice?: number;
}

export interface HistoricalCountSummary {
  key: string;
  label: string;
  count: number;
}

export interface HistoricalSeasonShape {
  openAuctionSpend: number;
  auctionPlayerCount: number;
  dollarPlayerCount: number;
  highPriceCounts: HistoricalCountSummary[];
  priceTierCounts: HistoricalCountSummary[];
  positionCounts: PositionAmounts;
  positionSpend: PositionAmounts;
  ownerSpend: OwnerAmounts;
}

export interface HistoricalBacktestGate {
  key: string;
  category: HistoricalBacktestGateCategory;
  label: string;
  status: HistoricalBacktestGateStatus;
  target: number;
  actual: number;
  delta: number;
  warnThreshold: number;
  failThreshold: number;
}

export interface HistoricalBacktestGateSummary {
  status: HistoricalBacktestGateStatus;
  credible: boolean;
  gateCount: number;
  passCount: number;
  warnCount: number;
  failCount: number;
}

export interface HistoricalBacktestGates {
  summary: HistoricalBacktestGateSummary;
  items: HistoricalBacktestGate[];
}

export interface HistoricalBacktestDeltaSummary {
  season: number;
  key: string;
  category: HistoricalBacktestGateCategory;
  label: string;
  target: number;
  actual: number;
  delta: number;
  thresholdPressure: number;
  status: HistoricalBacktestGateStatus;
}

export interface HistoricalSeasonBacktest {
  season: number;
  sourceSeasons: number[];
  actual: HistoricalSeasonShape;
  baseline: HistoricalSeasonShape;
  gates: HistoricalBacktestGates;
}

export interface HistoricalBacktestSummary extends HistoricalBacktestGateSummary {
  seasonCount: number;
  largestDeltas: HistoricalBacktestDeltaSummary[];
}

export interface HistoricalBacktestReport {
  method: HistoricalBacktestMethod;
  historicalSeasons: number[];
  summary: HistoricalBacktestSummary;
  seasonBacktests: HistoricalSeasonBacktest[];
  notes: string[];
}
