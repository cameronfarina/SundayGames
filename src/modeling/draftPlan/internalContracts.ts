import type { Position } from "../../../config/league.js";
import type {
  DraftPlanCandidate,
  DraftPlanPivotRule,
  DraftPlanPlayer,
  DraftPlanPriceBand,
  DraftPlanStrategyKey,
} from "./contracts.js";

export interface ThreeRbPathRules {
  rbCoreBudget: {
    targetCount: number;
    minimumSpend: number;
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  priceBands: readonly DraftPlanPriceBand[];
  slotMaxBids: Partial<Record<Position, readonly number[]>>;
  pivotRules: readonly DraftPlanPivotRule[];
}

export interface ThreeRbAuctionVariant {
  rbCoreBudget: {
    hardBudget: number;
    minimumFutureCorePrice: number;
  };
  rbSlotMaxBids: readonly number[];
  rbDemandMultiplier: number;
  priceAggression: number;
  scarcityChase: number;
  replacementPatience: number;
  anchorAggression: number;
  depthAggression: number;
}

export interface StrategyPlanRule {
  priceBands: readonly DraftPlanPriceBand[];
  pivotRules: readonly DraftPlanPivotRule[];
}

export type StrategyPlanRules = Record<DraftPlanStrategyKey, StrategyPlanRule>;
export type CoachSlotKey = "RB1" | "RB2" | "RB3" | "WR1" | "WR2" | "TE";

export interface CoachSlotDefinition {
  slot: CoachSlotKey;
  position: Position;
  playerForCandidate: (candidate: DraftPlanCandidate) => DraftPlanPlayer | undefined;
  note: string;
}
