import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { PricingSourcePrice } from "../pricingSnapshots.js";

export interface CurrentKeeperPrice {
  normalizedName: string;
  priceDollars: number;
}

export interface CreateLeagueCalibratedPricingSnapshotsInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioIds: readonly string[];
  baselinePrices: readonly PricingSourcePrice[];
  historicalSaleRecords: readonly HistoricalSaleRecord[];
  currentAuctionBudget?: number;
  currentTeamCount?: number;
  currentRosterSize?: number;
  currentMinimumBidDollars?: number;
  currentKeeperCount?: number;
  keeperLockedSpend?: number;
  currentKeepers?: readonly CurrentKeeperPrice[];
  createdAt?: string;
}

export type LeagueInflationSource = "history" | "budget" | "unavailable";

export interface LeagueInflationResult {
  multiplier: number;
  source: LeagueInflationSource;
  countedSaleCount: number;
  leagueDollars: number;
  publicDollars: number;
}
