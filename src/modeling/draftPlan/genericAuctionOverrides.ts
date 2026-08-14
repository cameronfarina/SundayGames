import type { Owner } from "../../../config/league.js";
import type { AuctionEngineConfigOverrides } from "../auctionEngine.js";
import type { DraftPlanStrategyKey } from "./contracts.js";

const balancedOverridesFor = (owner: Owner): AuctionEngineConfigOverrides => ({
  ownerDemandMultipliers: {
    [owner]: { QB: 0.65, RB: 1.04, WR: 1.06, TE: 0.82 },
  },
  ownerBehaviors: {
    [owner]: {
      priceAggression: 1.02,
      scarcityChase: 1.06,
      replacementPatience: 1,
      anchorAggression: 1.1,
      depthAggression: 0.98,
    },
  },
  ownerPositionSlotMaxBids: {
    [owner]: {
      RB: [58, 46, 24, 10, 4],
      WR: [54, 38, 24, 12, 6, 3, 1],
      TE: [8, 2],
      K: [1],
      DST: [1],
    },
  },
});

const heroRbOverridesFor = (owner: Owner): AuctionEngineConfigOverrides => ({
  ownerDemandMultipliers: {
    [owner]: { QB: 0.65, RB: 1.08, WR: 1.14, TE: 0.82 },
  },
  ownerBehaviors: {
    [owner]: {
      priceAggression: 1.03,
      scarcityChase: 1.08,
      replacementPatience: 0.99,
      anchorAggression: 1.12,
      depthAggression: 0.96,
    },
  },
  ownerPositionAnchorTargets: { [owner]: { RB: 1 } },
  ownerPositionSlotMaxBids: {
    [owner]: {
      RB: [62, 22, 12, 5, 2],
      WR: [45, 34, 24, 14, 8, 4, 1],
      TE: [8, 2],
      K: [1],
      DST: [1],
    },
  },
});

const wrHeavyOverridesFor = (owner: Owner): AuctionEngineConfigOverrides => ({
  ownerDemandMultipliers: {
    [owner]: { QB: 0.62, RB: 0.9, WR: 1.24, TE: 0.82 },
  },
  ownerBehaviors: {
    [owner]: {
      priceAggression: 1.05,
      scarcityChase: 1.12,
      replacementPatience: 0.98,
      anchorAggression: 1.18,
      depthAggression: 1.02,
    },
  },
  ownerPositionAnchorTargets: { [owner]: { WR: 3 } },
  ownerPositionSlotMaxBids: {
    [owner]: {
      RB: [42, 24, 12, 5, 2],
      WR: [58, 48, 36, 20, 12, 6, 2],
      TE: [7, 2],
      K: [1],
      DST: [1],
    },
  },
});

export const genericAuctionOverridesFor = (
  owner: Owner,
  strategyKey: DraftPlanStrategyKey,
): AuctionEngineConfigOverrides | undefined => {
  if (strategyKey === "balanced") return balancedOverridesFor(owner);
  if (strategyKey === "hero-rb") return heroRbOverridesFor(owner);
  if (strategyKey === "wr-heavy") return wrHeavyOverridesFor(owner);
  return undefined;
};
