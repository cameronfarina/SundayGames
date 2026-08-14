import type { Position } from "../../../config/league.js";
import type {
  PlayerContextConfig,
  PlayerContextEvidence,
  PlayerContextNotes,
  PlayerContextSignals,
} from "../../../config/playerContext.js";
import type { ProjectionRanking } from "../projectionRankings.js";

export type PositionAmounts = Record<Position, number>;

export interface ProjectionFloorRule {
  triggerAtRankGapOrBelow: number;
  topRankPrice: number;
  referenceRank: number;
  referenceRankPrice: number;
  tailDecay: number;
}

export interface ProjectionRankPriceFloor {
  maxProjectionRank: number;
  price: number;
}

export interface TopAnchorMinimum {
  espnAuctionValueAtLeast: number;
  shareOfAnchoredPrice: number;
}

export interface TopPriceVolumeLimit {
  threshold: number;
  maxCount: number;
}

export interface HistoricalPricePriorConfig {
  enabled: boolean;
  minimumHistoricalPrice: number;
  minimumCurrentAnchorValue: number;
  maximumCurrentEspnRank: number;
  recencyDecay: number;
  singleSeasonFloorShare: number;
  multiSeasonFloorShare: number;
  projectionRankBoostPerRank: number;
  maxProjectionRankBoost: number;
  negativeContextPenaltyMultiplier: number;
  maxNegativeContextPenalty: number;
}

export interface PricingConfig {
  draftedPoolCounts: PositionAmounts;
  positionMarketMultipliers: PositionAmounts;
  marketPressureByPosition: PositionAmounts;
  hardPriceCeilings: PositionAmounts;
  auditedSpendTargets: PositionAmounts;
  rankGapAdjustmentPerRank: number;
  rankGapAdjustmentCap: number;
  topAnchorMinimum: TopAnchorMinimum;
  projectionFloorRules: Partial<Record<Position, ProjectionFloorRule>>;
  projectionRankPriceFloors: Partial<Record<Position, readonly ProjectionRankPriceFloor[]>>;
  playerContext: PlayerContextConfig;
  historicalPricePrior: HistoricalPricePriorConfig;
  topPriceVolumeLimits: readonly TopPriceVolumeLimit[];
  spendTargetRoundingPriority: readonly Position[];
}

export interface BasePrice extends ProjectionRanking {
  publicAnchorValue: number;
  positionMultiplier: number;
  rankGapAdjustment: number;
  marketPressure: number;
  anchoredPrice: number;
  projectionFloorPrice: number;
  preSustainabilityPrice: number;
  sustainabilityFactor: number;
  sustainabilityNote?: string;
  contextAdjustmentFactor: number;
  contextAdjustmentPercent: number;
  contextSignals: PlayerContextSignals;
  contextNotes?: PlayerContextNotes;
  contextEvidence?: readonly PlayerContextEvidence[];
  rawPrice: number;
  historicalAuctionCount: number;
  historicalRoomPrice: number;
  historicalRoomFloor: number;
  historicalRoomFloorShare: number;
  minimumPrice: number;
  hardCeiling: number;
  spendTarget: number;
  price: number;
}

export interface PricePoolSummary {
  counts: PositionAmounts;
  spend: PositionAmounts;
  total: number;
}

export interface PriceCandidate extends Omit<BasePrice, "price"> {
  allocationWeight: number;
}

export interface AllocationCandidate extends PriceCandidate {
  allocationCeiling: number;
}
