import { ownerOrder, type Owner, type Position } from "../../../config/league.js";
import type {
  OwnerAuctionBehaviors,
  OwnerDemandMultipliers,
  OwnerPositionAnchorTargets,
  OwnerPositionCoreBudgetEnvelopes,
  OwnerPositionCoreMaxBids,
  OwnerPositionCoreTargets,
  OwnerPositionSlotMaxBids,
  OwnerRosterMaximums,
  PositionCoreBudgetEnvelope,
} from "../auctionEngine.js";

type OwnerPositionNumbers = Partial<Record<Owner, Partial<Record<Position, number>>>>;
type OwnerPositionPriceLadders =
  Partial<Record<Owner, Partial<Record<Position, readonly number[]>>>>;
type OwnerPositionBudgetEnvelopes =
  Partial<Record<Owner, Partial<Record<Position, PositionCoreBudgetEnvelope>>>>;

const mergeNumberMaps = (
  base: OwnerPositionNumbers,
  overrides?: OwnerPositionNumbers,
): OwnerPositionNumbers => {
  if (!overrides) return base;
  const merged: OwnerPositionNumbers = { ...base };
  for (const owner of ownerOrder) {
    if (base[owner] || overrides[owner]) {
      merged[owner] = { ...(base[owner] ?? {}), ...(overrides[owner] ?? {}) };
    }
  }
  return merged;
};

export const mergeOwnerDemandMultipliers = (
  base: OwnerDemandMultipliers,
  overrides?: OwnerDemandMultipliers,
): OwnerDemandMultipliers => mergeNumberMaps(base, overrides);

export const mergeOwnerRosterMaximums = (
  base: OwnerRosterMaximums,
  overrides?: OwnerRosterMaximums,
): OwnerRosterMaximums => mergeNumberMaps(base, overrides);

export const mergeOwnerPositionAnchorTargets = (
  base: OwnerPositionAnchorTargets,
  overrides?: OwnerPositionAnchorTargets,
): OwnerPositionAnchorTargets => mergeNumberMaps(base, overrides);

const mergePriceLadders = (
  base: OwnerPositionPriceLadders,
  overrides?: OwnerPositionPriceLadders,
): OwnerPositionPriceLadders => {
  if (!overrides) return base;
  const merged: OwnerPositionPriceLadders = { ...base };
  for (const owner of ownerOrder) {
    if (base[owner] || overrides[owner]) {
      merged[owner] = { ...(base[owner] ?? {}), ...(overrides[owner] ?? {}) };
    }
  }
  return merged;
};

export const mergeOwnerPositionCoreTargets = (
  base: OwnerPositionCoreTargets,
  overrides?: OwnerPositionCoreTargets,
): OwnerPositionCoreTargets => mergePriceLadders(base, overrides);

export const mergeOwnerPositionCoreMaxBids = (
  base: OwnerPositionCoreMaxBids,
  overrides?: OwnerPositionCoreMaxBids,
): OwnerPositionCoreMaxBids => mergePriceLadders(base, overrides);

export const mergeOwnerPositionSlotMaxBids = (
  base: OwnerPositionSlotMaxBids,
  overrides?: OwnerPositionSlotMaxBids,
): OwnerPositionSlotMaxBids => mergePriceLadders(base, overrides);

export const mergeOwnerPositionCoreBudgetEnvelopes = (
  base: OwnerPositionCoreBudgetEnvelopes,
  overrides?: OwnerPositionCoreBudgetEnvelopes,
): OwnerPositionCoreBudgetEnvelopes => {
  if (!overrides) return base;
  const merged: OwnerPositionBudgetEnvelopes = { ...base };
  for (const owner of ownerOrder) {
    if (base[owner] || overrides[owner]) {
      merged[owner] = { ...(base[owner] ?? {}), ...(overrides[owner] ?? {}) };
    }
  }
  return merged;
};

export const mergeOwnerAuctionBehaviors = (
  base: OwnerAuctionBehaviors,
  overrides?: OwnerAuctionBehaviors,
): OwnerAuctionBehaviors => {
  if (!overrides) return base;
  const merged: OwnerAuctionBehaviors = { ...base };

  for (const owner of ownerOrder) {
    if (!base[owner] && !overrides[owner]) continue;
    const behavior = { ...(base[owner] ?? {}), ...(overrides[owner] ?? {}) };
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
