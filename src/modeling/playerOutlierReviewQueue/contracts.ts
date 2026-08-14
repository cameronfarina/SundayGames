import type { SanityFlagKey } from "../topPlayerSanity.js";

export type PlayerOutlierPriority = "high" | "medium" | "low";
export type PlayerOutlierReviewStatus = "open";
export type PlayerOutlierReasonKey =
  | SanityFlagKey
  | "mockSaleDiscount"
  | "mockSaleRange"
  | "thinMockDemand"
  | "anchorToScenarioJump"
  | "eliteTierContributor";

export interface PlayerOutlierReason {
  key: PlayerOutlierReasonKey;
  severity: "review" | "info";
  message: string;
  threshold: string;
  actual: string;
}

export interface PlayerOutlierReviewRow {
  priority: PlayerOutlierPriority;
  rank: number;
  player: string;
  position: string;
  publicAnchorValue: number;
  basePrice: number;
  scenarioPrice: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  minMockSalePrice: number;
  maxMockSalePrice: number;
  mockSaleRange: number;
  draftedRate: number;
  rankGap: number | null;
  contextAdjustmentPercent: number;
  currentEvidenceCount: number;
  primaryReason: PlayerOutlierReasonKey;
  outlierReasons: readonly PlayerOutlierReason[];
  thresholds: readonly string[];
  auditCommand: string;
  reviewStatus: PlayerOutlierReviewStatus;
  reviewNote: string;
}

export interface PlayerOutlierReviewQueueSummary {
  playerCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  reasonCounts: Partial<Record<PlayerOutlierReasonKey, number>>;
}

export interface PlayerOutlierReviewQueue {
  summary: PlayerOutlierReviewQueueSummary;
  rows: readonly PlayerOutlierReviewRow[];
}
