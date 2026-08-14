import type { Owner } from "../../../config/league.js";
import type {
  OwnerAuctionBehaviors,
  OwnerDemandMultipliers,
  OwnerPositionCoreBudgetEnvelopes,
  OwnerPositionCoreTargets,
} from "../auctionEngine.js";

const ownerKeys = <T>(base: Partial<Record<Owner, T>>, overrides: Partial<Record<Owner, T>>): Owner[] =>
  [...new Set([...Object.keys(base), ...Object.keys(overrides)])];

export const mergeOwnerPositionMaps = (
  base: OwnerDemandMultipliers,
  overrides?: OwnerDemandMultipliers,
): OwnerDemandMultipliers => {
  if (!overrides) return base;

  const merged: OwnerDemandMultipliers = { ...base };
  for (const owner of ownerKeys(base, overrides)) {
    merged[owner] = {
      ...base[owner],
      ...overrides[owner],
    };
  }
  return merged;
};

export const mergeOwnerPriceLadders = (
  base: OwnerPositionCoreTargets,
  overrides?: OwnerPositionCoreTargets,
): OwnerPositionCoreTargets => {
  if (!overrides) return base;

  const merged: OwnerPositionCoreTargets = { ...base };
  for (const owner of ownerKeys(base, overrides)) {
    merged[owner] = {
      ...base[owner],
      ...overrides[owner],
    };
  }
  return merged;
};

export const mergeOwnerPositionCoreBudgetEnvelopes = (
  base: OwnerPositionCoreBudgetEnvelopes,
  overrides?: OwnerPositionCoreBudgetEnvelopes,
): OwnerPositionCoreBudgetEnvelopes => {
  if (!overrides) return base;

  const merged: OwnerPositionCoreBudgetEnvelopes = { ...base };
  for (const owner of ownerKeys(base, overrides)) {
    merged[owner] = {
      ...base[owner],
      ...overrides[owner],
    };
  }
  return merged;
};

export const mergeOwnerAuctionBehaviors = (
  base: OwnerAuctionBehaviors,
  overrides?: OwnerAuctionBehaviors,
): OwnerAuctionBehaviors => {
  if (!overrides) return base;

  const merged: OwnerAuctionBehaviors = { ...base };
  for (const owner of ownerKeys(base, overrides)) {
    const behavior = {
      ...base[owner],
      ...overrides[owner],
    };
    const { priceAggression, scarcityChase, replacementPatience } = behavior;
    if (
      priceAggression === undefined ||
      scarcityChase === undefined ||
      replacementPatience === undefined
    ) {
      throw new Error(`Incomplete auction behavior override for ${owner}.`);
    }

    merged[owner] = {
      priceAggression,
      scarcityChase,
      replacementPatience,
      ...(behavior.anchorAggression === undefined
        ? {}
        : { anchorAggression: behavior.anchorAggression }),
      ...(behavior.depthAggression === undefined
        ? {}
        : { depthAggression: behavior.depthAggression }),
    };
  }
  return merged;
};
