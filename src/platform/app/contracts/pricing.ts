import type { HistoricalSaleRecord } from "../../historicalImports.js";
import type { PricingSourcePrice } from "../../pricingSnapshots.js";

export interface RebuildPlatformPricingInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number;
  modelVersion: string;
  scenarioIds: readonly string[];
  baselinePrices: readonly PricingSourcePrice[];
  currentKeeperCount?: number | undefined;
  keeperLockedSpend?: number | undefined;
  historicalSaleRecords?: readonly HistoricalSaleRecord[] | undefined;
  now?: Date | undefined;
}

export interface PreflightPlatformPricingInput extends RebuildPlatformPricingInput {}

export interface ListPlatformPricingSnapshotsInput {
  actorSessionToken: string;
  leagueId: string;
  seasonYear: number | string;
  modelRunId?: string | undefined;
  scenarioId?: string | undefined;
  now?: Date | undefined;
}

export interface GetLatestLeaguePricingSnapshotInput extends ListPlatformPricingSnapshotsInput {}

export interface GetPlatformPricingSnapshotInput {
  actorSessionToken: string;
  modelRunId: string;
  scenarioId?: string | undefined;
  now?: Date | undefined;
}
