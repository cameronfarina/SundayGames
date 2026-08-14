import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { Position } from "../../../config/league.js";
import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ProjectionRecord } from "../../projections.js";
import type { PricingConfig } from "../basePricing.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { MockBatch } from "../mockBatch.js";

export type SanityFlagKey =
  | "highMockPremium"
  | "largeProjectionRankLift"
  | "missingFactualEvidence"
  | "contextPenalty"
  | "hardCeilingPressure";

export type SanityFlagSeverity = "info" | "review";
export type HighPriceVolumeStatus = "pass" | "review";

export interface BuildTopPlayerSanityReportOptions {
  projections: readonly ProjectionRecord[];
  historicalRecords: readonly HistoricalAuctionRecord[];
  keepers: readonly KeeperDeclaration[];
  scenarioKey?: KeeperScenarioKey;
  limit?: number;
  runs?: number;
  seedPrefix?: string;
  pricingConfig?: PricingConfig;
  mockBatch?: MockBatch;
}

export interface SanityFlag {
  key: SanityFlagKey;
  severity: SanityFlagSeverity;
  message: string;
}

export interface TopPlayerSanityRow {
  rank: number;
  name: string;
  position: Position;
  publicAnchorValue: number;
  projectionRank: number;
  espnRank: number | null;
  rankGap: number | null;
  basePrice: number;
  scenarioPrice: number;
  draftedCount: number;
  draftedRate: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  minMockSalePrice: number;
  maxMockSalePrice: number;
  contextAdjustmentPercent: number;
  contextEvidenceCount: number;
  contextEvidence?: readonly PlayerContextEvidence[];
  flags: readonly SanityFlag[];
}

export interface HighPriceVolumeSanity {
  threshold: number;
  historicalAverageCount: number;
  historicalMaxCount: number;
  scenarioCount: number;
  mockAverageCount: number;
  mockMaxCount: number;
  status: HighPriceVolumeStatus;
}

export interface TopPlayerSanitySummary {
  reviewedCount: number;
  flaggedPlayerCount: number;
  flagCounts: Partial<Record<SanityFlagKey, number>>;
  highPriceVolume: HighPriceVolumeSanity[];
}

export interface TopPlayerSanityReport {
  config: {
    scenarioKey: KeeperScenarioKey;
    limit: number;
    runs: number;
    seedPrefix: string;
  };
  scenario: {
    label: string;
    openAuctionDollars: number;
    globalFactor: number;
  };
  summary: TopPlayerSanitySummary;
  players: TopPlayerSanityRow[];
  flaggedPlayers: TopPlayerSanityRow[];
}

export interface MockSaleSummary {
  draftedCount: number;
  draftedRate: number;
  averageSalePrice: number;
  saleVsScenarioPrice: number;
  minSalePrice: number;
  maxSalePrice: number;
}
