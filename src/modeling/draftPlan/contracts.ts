import type { Owner, Position } from "../../../config/league.js";
import type { LineupEntry } from "../../types.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import type { MockBatch } from "../mockBatch.js";

export type DraftPlanStrategyKey = LiveDraftStrategyKey;

export interface DraftPlanStrategyDefinition {
  key: DraftPlanStrategyKey;
  label: string;
  thresholds: {
    rb1Minimum: number;
    rb2Minimum: number;
    rb3Minimum: number;
    rbCoreSpendMinimum: number;
  };
}

export interface DraftPlanPriceBand {
  slot: string;
  position: Position;
  minimumPrice: number;
  maximumPrice: number;
  note: string;
}

export interface DraftPlanTargetCluster {
  label: string;
  position: Position;
  targetNames: string[];
  priceBand: string;
  note: string;
}

export interface DraftPlanPivotRule {
  label: string;
  trigger: string;
  action: string;
}

export type DraftPlanRiskStatus = "pass" | "warn" | "fail";

export interface DraftPlanSlotBlueprint {
  slot: string;
  position: Position;
  sampleCount: number;
  minimumPrice: number;
  maximumPrice: number;
  averagePrice: number;
  priceBand: string;
  lockedNames: string[];
  targetNames: string[];
  fallbackPriceBand: string;
  fallbackNames: string[];
  note: string;
}

export interface DraftPlanContingencyPlan {
  label: string;
  trigger: string;
  action: string;
  targetNames: string[];
  priceBand: string;
}

export interface DraftPlanRiskGuardrail {
  label: string;
  status: DraftPlanRiskStatus;
  detail: string;
}

export interface DraftPlanStrategyCoach {
  headline: string;
  sampleSize: number;
  averageWeeks1To4Score: number;
  blueprint: DraftPlanSlotBlueprint[];
  contingencyPlans: DraftPlanContingencyPlan[];
  riskGuardrails: DraftPlanRiskGuardrail[];
}

export interface DraftPlanRecommendations {
  maxPriceBands: DraftPlanPriceBand[];
  targetClusters: DraftPlanTargetCluster[];
  pivotRules: DraftPlanPivotRule[];
  deadZoneWarnings: string[];
  strategyCoach: DraftPlanStrategyCoach;
}

export interface DraftPlanPlayerMarket {
  averageMarketPrice: number;
  averageSalePrice: number;
  minimumSalePrice: number;
  maximumSalePrice: number;
  draftedRate: number;
}

export interface DraftPlanPlayer {
  name: string;
  position: Position;
  price: number;
  weeks1To4: number;
  market?: DraftPlanPlayerMarket;
}

export interface DraftPlanLineupEntry {
  slot: LineupEntry["slot"];
  player: DraftPlanPlayer;
}

export interface DraftPlanCandidate {
  seed: string;
  scenarioKey: string;
  owner: Owner;
  strategy: DraftPlanStrategyKey;
  rosterSpend: number;
  budgetRemaining: number;
  week1Score: number;
  weeks1To4Score: number;
  rbCoreSpend: number;
  positionSpend: Record<Position, number>;
  rbCore: DraftPlanPlayer[];
  lineup: DraftPlanLineupEntry[];
  bench: DraftPlanPlayer[];
  players: DraftPlanPlayer[];
}

export interface BuildDraftPlanReportOptions {
  batch: MockBatch;
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  limit?: number;
}

export interface DraftPlanReport {
  owner: Owner;
  strategy: DraftPlanStrategyDefinition;
  engineMode: "fast" | "full";
  runCount: number;
  matchedRunCount: number;
  candidateLimit: number;
  recommendations: DraftPlanRecommendations;
  candidates: DraftPlanCandidate[];
}

export interface DraftPlanAuctionOverridesOptions {
  owner: Owner;
  strategyKey: DraftPlanStrategyKey;
  variantSeed?: string;
}
