import type { Owner } from "../../../config/league.js";
import type { AuctionEngineConfigOverrides } from "../auctionEngine.js";
import type { ThreeRbAuctionVariant } from "./internalContracts.js";
import { threeRbPathRules } from "./threeRbPathRules.js";

export const threeRbAuctionOverridesFor = (
  owner: Owner,
  variant: ThreeRbAuctionVariant,
): AuctionEngineConfigOverrides => ({
  ownerDemandMultipliers: {
    [owner]: {
      QB: 0.55,
      RB: variant.rbDemandMultiplier,
      WR: 1.08,
      TE: 0.75,
    },
  },
  ownerBehaviors: {
    [owner]: {
      priceAggression: variant.priceAggression,
      scarcityChase: variant.scarcityChase,
      replacementPatience: variant.replacementPatience,
      anchorAggression: variant.anchorAggression,
      depthAggression: variant.depthAggression,
    },
  },
  ownerRosterMaximums: {
    [owner]: { QB: 1, RB: 5, WR: 7, TE: 2, K: 1, DST: 1 },
  },
  ownerPositionAnchorTargets: {
    [owner]: { RB: 3 },
  },
  ownerPositionCoreBudgetEnvelopes: {
    [owner]: {
      RB: {
        targetCount: threeRbPathRules.rbCoreBudget.targetCount,
        hardBudget: variant.rbCoreBudget.hardBudget,
        minimumFutureCorePrice: variant.rbCoreBudget.minimumFutureCorePrice,
      },
    },
  },
  ownerPositionSlotMaxBids: {
    [owner]: {
      RB: [...variant.rbSlotMaxBids],
      WR: [...(threeRbPathRules.slotMaxBids.WR ?? [])],
      TE: [...(threeRbPathRules.slotMaxBids.TE ?? [])],
      K: [...(threeRbPathRules.slotMaxBids.K ?? [])],
      DST: [...(threeRbPathRules.slotMaxBids.DST ?? [])],
    },
  },
});
