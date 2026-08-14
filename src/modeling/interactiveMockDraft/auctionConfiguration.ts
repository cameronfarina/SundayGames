import type { Owner } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import {
  buildAuctionConfig,
  buildOwnerAuctionBehaviors,
  buildOwnerDemandMultipliers,
  buildOwnerRosterMaximums,
  buildRunVariantOwnerAuctionBehaviors,
  buildRunVariantOwnerDemandMultipliers,
  type AuctionEngineConfig,
  type AuctionEngineConfigOverrides,
} from "../auctionEngine.js";
import { draftPlanAuctionOverridesFor } from "../draftPlan.js";
import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import { buildOwnerProfiles } from "../ownerProfiles.js";
import {
  mergeOwnerAuctionBehaviors,
  mergeOwnerPositionCoreBudgetEnvelopes,
  mergeOwnerPositionMaps,
  mergeOwnerPriceLadders,
} from "./configMerging.js";

export const strategyAuctionOverridesFor = (
  owner: Owner,
  strategyKey: LiveDraftStrategyKey,
  options: { variantSeed?: string } = {},
): AuctionEngineConfigOverrides => draftPlanAuctionOverridesFor({
  owner,
  strategyKey,
  ...(options.variantSeed === undefined ? {} : { variantSeed: options.variantSeed }),
});

export const buildInteractiveAuctionConfig = ({
  historicalRecords,
  seed,
  watchOwner,
  strategyKey,
}: {
  historicalRecords: readonly HistoricalAuctionRecord[];
  seed: string;
  watchOwner: Owner;
  strategyKey: LiveDraftStrategyKey;
}): AuctionEngineConfig => {
  const profiles = buildOwnerProfiles(historicalRecords);
  const demand = buildRunVariantOwnerDemandMultipliers(
    buildOwnerDemandMultipliers(profiles),
    seed,
  );
  const behaviors = buildRunVariantOwnerAuctionBehaviors(
    buildOwnerAuctionBehaviors(profiles),
    seed,
  );
  const overrides = strategyAuctionOverridesFor(watchOwner, strategyKey);

  return buildAuctionConfig({
    seed,
    nomination: { tieBreakWeight: 0.08 },
    bidVariance: { maxDiscount: 0.13, maxPremium: 0.12 },
    ownerDemandMultipliers: mergeOwnerPositionMaps(
      demand,
      overrides.ownerDemandMultipliers,
    ),
    ownerBehaviors: mergeOwnerAuctionBehaviors(behaviors, overrides.ownerBehaviors),
    ownerRosterMaximums: mergeOwnerPositionMaps(
      buildOwnerRosterMaximums(profiles),
      overrides.ownerRosterMaximums,
    ),
    ownerPositionAnchorTargets: mergeOwnerPositionMaps(
      {},
      overrides.ownerPositionAnchorTargets,
    ),
    ownerPositionCoreTargets: mergeOwnerPriceLadders(
      {},
      overrides.ownerPositionCoreTargets,
    ),
    ownerPositionCoreMaxBids: mergeOwnerPriceLadders(
      {},
      overrides.ownerPositionCoreMaxBids,
    ),
    ownerPositionSlotMaxBids: mergeOwnerPriceLadders(
      {},
      overrides.ownerPositionSlotMaxBids,
    ),
    ownerPositionCoreBudgetEnvelopes: mergeOwnerPositionCoreBudgetEnvelopes(
      {},
      overrides.ownerPositionCoreBudgetEnvelopes,
    ),
  });
};
