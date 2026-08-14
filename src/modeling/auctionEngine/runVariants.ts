import { ownerOrder, positions, type Position } from "../../../config/league.js";
import { OwnerAuctionBehaviors, OwnerDemandMultipliers } from "./configContracts.js";
import { clamp } from "./coreMath.js";
import { defaultOwnerAuctionBehavior } from "./demand.js";
import { OwnerRunVarianceConfig, blendMultiplierToNeutral, jitterMultiplier, ownerRunVarianceConfigFor, runBuildStyleMultipliersFor } from "./variance.js";

export const buildRunVariantOwnerDemandMultipliers = (
  base: OwnerDemandMultipliers,
  seed: string,
  options: Partial<OwnerRunVarianceConfig> = {},
): OwnerDemandMultipliers => {
  const variance = ownerRunVarianceConfigFor(options);
  const multipliersByOwner: OwnerDemandMultipliers = {};

  for (const owner of ownerOrder) {
    const multipliers: Partial<Record<Position, number>> = {};

    for (const position of positions) {
      const baseMultiplier = base[owner]?.[position] ?? 1;
      const positionJitter = position === "K" || position === "DST"
        ? variance.specialTeamsDemandJitter
        : variance.demandJitter;
      const adjustedMultiplier =
        blendMultiplierToNeutral(baseMultiplier, variance.demandPriorWeight) *
        jitterMultiplier(seed, owner, `demand:${position}`, positionJitter);

      multipliers[position] = clamp(adjustedMultiplier, 0.82, 1.2);
    }

    multipliersByOwner[owner] = multipliers;
  }

  return multipliersByOwner;
};

export const buildRunVariantOwnerAuctionBehaviors = (
  base: OwnerAuctionBehaviors,
  seed: string,
  options: Partial<OwnerRunVarianceConfig> = {},
): OwnerAuctionBehaviors => {
  const variance = ownerRunVarianceConfigFor(options);
  const behaviors: OwnerAuctionBehaviors = {};

  for (const owner of ownerOrder) {
    const baseBehavior = {
      ...defaultOwnerAuctionBehavior,
      ...base[owner],
    };
    const buildStyle = runBuildStyleMultipliersFor(seed, owner);

    behaviors[owner] = {
      priceAggression: clamp(
        blendMultiplierToNeutral(baseBehavior.priceAggression, variance.behaviorPriorWeight) *
          buildStyle.priceAggression *
          jitterMultiplier(seed, owner, "priceAggression", variance.priceAggressionJitter),
        0.86,
        1.16,
      ),
      scarcityChase: clamp(
        blendMultiplierToNeutral(baseBehavior.scarcityChase, variance.behaviorPriorWeight) *
          buildStyle.scarcityChase *
          jitterMultiplier(seed, owner, "scarcityChase", variance.scarcityChaseJitter),
        0.82,
        1.22,
      ),
      replacementPatience: clamp(
        blendMultiplierToNeutral(baseBehavior.replacementPatience, variance.behaviorPriorWeight) *
          buildStyle.replacementPatience *
          jitterMultiplier(seed, owner, "replacementPatience", variance.replacementPatienceJitter),
        0.88,
        1.12,
      ),
      anchorAggression: clamp(
        blendMultiplierToNeutral(baseBehavior.anchorAggression, variance.behaviorPriorWeight) *
          buildStyle.anchorAggression *
          jitterMultiplier(seed, owner, "anchorAggression", variance.anchorAggressionJitter),
        0.82,
        1.24,
      ),
      depthAggression: clamp(
        blendMultiplierToNeutral(baseBehavior.depthAggression, variance.behaviorPriorWeight) *
          buildStyle.depthAggression *
          jitterMultiplier(seed, owner, "depthAggression", variance.depthAggressionJitter),
        0.82,
        1.24,
      ),
    };
  }

  return behaviors;
};
