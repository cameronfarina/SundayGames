import type { Position } from "../../../config/league.js";
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

export interface CalibrationResult {
  price: number;
  historicalMove: number;
}

export interface PositionInflationResult {
  multipliers: ReadonlyMap<Position, number>;
  publicValueCoverage: ReadonlyMap<Position, number>;
  matchedSaleCount: number;
}

export interface PositionSaleCurveResult {
  pricesByPosition: ReadonlyMap<Position, readonly number[]>;
}

export interface LeagueAuctionAllocation {
  scenarioPrices: readonly number[];
  personalValues?: readonly number[];
  warnings: readonly string[];
}

export interface WholeDollarAllocation {
  allocations: readonly number[];
  unallocatedDollars: number;
}
