import { defaultPlayerContextConfig } from "../../../config/playerContext.js";
import type { PricingConfig } from "./contracts.js";

export const defaultPricingConfig: PricingConfig = {
  draftedPoolCounts: { QB: 22, RB: 70, WR: 70, TE: 20, K: 14, DST: 14 },
  positionMarketMultipliers: {
    QB: 1.08,
    RB: 1.28,
    WR: 1.28,
    TE: 1.1,
    K: 1,
    DST: 1,
  },
  marketPressureByPosition: {
    QB: 0.98,
    RB: 0.97,
    WR: 0.97,
    TE: 0.98,
    K: 1,
    DST: 1,
  },
  hardPriceCeilings: { QB: 35, RB: 80, WR: 80, TE: 38, K: 5, DST: 6 },
  auditedSpendTargets: { QB: 200, RB: 1036, WR: 1152, TE: 163, K: 23, DST: 23 },
  rankGapAdjustmentPerRank: 0.01,
  rankGapAdjustmentCap: 0.12,
  topAnchorMinimum: {
    espnAuctionValueAtLeast: 50,
    shareOfAnchoredPrice: 0.97,
  },
  projectionFloorRules: {
    RB: {
      triggerAtRankGapOrBelow: -40,
      topRankPrice: 70,
      referenceRank: 16,
      referenceRankPrice: 22,
      tailDecay: 0.22,
    },
  },
  projectionRankPriceFloors: {
    QB: [{ maxProjectionRank: 1, price: 35 }],
    TE: [{ maxProjectionRank: 2, price: 38 }],
  },
  playerContext: defaultPlayerContextConfig,
  historicalPricePrior: {
    enabled: true,
    minimumHistoricalPrice: 30,
    minimumCurrentAnchorValue: 30,
    maximumCurrentEspnRank: 40,
    recencyDecay: 0.6,
    singleSeasonFloorShare: 0.9,
    multiSeasonFloorShare: 0.84,
    projectionRankBoostPerRank: 0.003,
    maxProjectionRankBoost: 0.04,
    negativeContextPenaltyMultiplier: 1.5,
    maxNegativeContextPenalty: 0.12,
  },
  topPriceVolumeLimits: [
    { threshold: 77, maxCount: 1 },
    { threshold: 72, maxCount: 3 },
    { threshold: 67, maxCount: 5 },
  ],
  spendTargetRoundingPriority: ["RB", "TE", "K", "DST", "WR", "QB"],
};
