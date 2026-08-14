import type { Position } from "../../../config/league.js";

export type JsonSnapshotValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonSnapshotValue[]
  | { readonly [key: string]: JsonSnapshotValue };

export interface PricingInputSnapshot {
  id: string;
  hash: string;
}

export interface PricingModelRunIdentityInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  inputHash: string;
}

export interface PricingSourcePrice {
  name: string;
  normalizedName: string;
  position: Position;
  price: number;
  scenarioPrice?: number;
  livePrice?: number;
  liveExpectedPrice?: number;
  personalValue?: number;
  recommendedMaxBid?: number;
  confidence?: number;
  tier?: string;
  warnings?: readonly string[];
}

export interface PricingExplanationRef {
  modelRunId: string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshotId: string;
  playerKey: string;
}

export interface PlayerPriceSnapshotRow {
  playerKey: string;
  playerName: string;
  normalizedName: string;
  position: Position;
  marketPrice: number;
  scenarioPrice: number;
  livePrice: number;
  personalValue: number;
  recommendedMaxBid: number;
  warnings: readonly string[];
  explanationRef: PricingExplanationRef;
  confidence?: number;
  tier?: string;
  strategyOverlayId?: string;
}

export interface PricingSnapshot {
  snapshotId: string;
  modelRunId: string;
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshot: PricingInputSnapshot;
  rows: readonly PlayerPriceSnapshotRow[];
  createdAt?: string;
  strategyOverlayId?: string;
}

export interface CreatePricingSnapshotInput {
  leagueId: string;
  seasonYear: number | string;
  modelVersion: string;
  scenarioId: string;
  inputSnapshot: PricingInputSnapshot;
  prices: readonly PricingSourcePrice[];
  createdAt?: string;
}

export interface PricingStrategyOverlay {
  strategyId: string;
  personalValueDeltas?: Readonly<Record<string, number>>;
  recommendedMaxBidDeltas?: Readonly<Record<string, number>>;
}

export interface LatestPricingSnapshotFilters {
  leagueId: string;
  seasonYear: number | string;
  modelRunId?: string;
  scenarioId?: string;
}

export interface PricingSnapshotRepository {
  save(snapshot: PricingSnapshot): PricingSnapshot;
  get(modelRunId: string, scenarioId?: string): PricingSnapshot | undefined;
  findLatest(filters: LatestPricingSnapshotFilters): PricingSnapshot | undefined;
  list(): readonly PricingSnapshot[];
}
