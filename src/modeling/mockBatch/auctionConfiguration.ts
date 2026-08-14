import {
  buildAuctionConfig,
  buildRunVariantOwnerAuctionBehaviors,
  buildRunVariantOwnerDemandMultipliers,
  type AuctionEngineConfig,
  type AuctionEngineConfigOverrides,
  type OwnerAuctionBehaviors,
  type OwnerDemandMultipliers,
  type OwnerRosterMaximums,
} from "../auctionEngine.js";
import {
  mergeOwnerAuctionBehaviors,
  mergeOwnerDemandMultipliers,
  mergeOwnerPositionAnchorTargets,
  mergeOwnerPositionCoreBudgetEnvelopes,
  mergeOwnerPositionCoreMaxBids,
  mergeOwnerPositionCoreTargets,
  mergeOwnerPositionSlotMaxBids,
  mergeOwnerRosterMaximums,
} from "./overrideMerging.js";

interface AuctionConfigurationOptions {
  ownerDemandMultipliers: OwnerDemandMultipliers;
  ownerBehaviors: OwnerAuctionBehaviors;
  ownerRosterMaximums: OwnerRosterMaximums;
  seed: string;
  overrides: AuctionEngineConfigOverrides;
}

export const buildMockAuctionConfig = ({
  ownerDemandMultipliers,
  ownerBehaviors,
  ownerRosterMaximums,
  seed,
  overrides,
}: AuctionConfigurationOptions): AuctionEngineConfig => buildAuctionConfig({
  ...overrides,
  seed,
  nomination: { tieBreakWeight: 0.08, ...overrides.nomination },
  bidVariance: { maxDiscount: 0.13, maxPremium: 0.12, ...overrides.bidVariance },
  ownerDemandMultipliers: mergeOwnerDemandMultipliers(
    buildRunVariantOwnerDemandMultipliers(ownerDemandMultipliers, seed),
    overrides.ownerDemandMultipliers,
  ),
  ownerBehaviors: mergeOwnerAuctionBehaviors(
    buildRunVariantOwnerAuctionBehaviors(ownerBehaviors, seed),
    overrides.ownerBehaviors,
  ),
  ownerRosterMaximums: mergeOwnerRosterMaximums(
    ownerRosterMaximums,
    overrides.ownerRosterMaximums,
  ),
  ownerPositionAnchorTargets: mergeOwnerPositionAnchorTargets(
    {},
    overrides.ownerPositionAnchorTargets,
  ),
  ownerPositionCoreTargets: mergeOwnerPositionCoreTargets(
    {},
    overrides.ownerPositionCoreTargets,
  ),
  ownerPositionCoreMaxBids: mergeOwnerPositionCoreMaxBids(
    {},
    overrides.ownerPositionCoreMaxBids,
  ),
  ownerPositionSlotMaxBids: mergeOwnerPositionSlotMaxBids(
    {},
    overrides.ownerPositionSlotMaxBids,
  ),
  ownerPositionCoreBudgetEnvelopes: mergeOwnerPositionCoreBudgetEnvelopes(
    {},
    overrides.ownerPositionCoreBudgetEnvelopes,
  ),
});
