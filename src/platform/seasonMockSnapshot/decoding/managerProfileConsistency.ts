import type { GenericAuctionMockAiTendency } from "../../genericAuctionMockEngine.js";
import type { ManagerDraftProfileSnapshot } from "../../managerDraftProfiles.js";
import {
  managerProfileConfidenceFor,
  managerProfileMaximumPremiumMultiplier,
  managerProfileMaximumTargetLift,
  managerProfileMinimumComparablePurchases,
  managerProfileMinimumPremiumMultiplier,
  managerProfileMinimumPurchases,
  managerProfileMinimumSeasons,
  managerProfileMinimumTargetLift,
  managerProfileStarBiddingFor,
} from "../../managerDraftProfiles/policy.js";
import { malformedSnapshot } from "../errors.js";

const expectedStarBidding = (
  tendency: GenericAuctionMockAiTendency,
): ManagerDraftProfileSnapshot["starBidding"] => {
  const multiplier = tendency.premiumBidMultiplier ?? 1;
  if (multiplier < managerProfileMinimumPremiumMultiplier
    || multiplier > managerProfileMaximumPremiumMultiplier) return malformedSnapshot();
  return managerProfileStarBiddingFor(multiplier);
};

const isExactTargetMap = (
  values: Readonly<Record<string, number>> | undefined,
  target: string,
): boolean => {
  if (values === undefined || Object.keys(values).length !== 1) return false;
  const multiplier = values[target];
  return multiplier !== undefined
    && multiplier >= managerProfileMinimumTargetLift
    && multiplier <= managerProfileMaximumTargetLift;
};

const assertTargetConsistency = (profile: ManagerDraftProfileSnapshot): void => {
  const tendency = profile.aiTendency;
  if (tendency === undefined) return malformedSnapshot();
  if (profile.targetPosition === null) {
    if (profile.targetLabel !== null && profile.targetLabel !== "Balanced") {
      return malformedSnapshot();
    }
    if (Object.keys(tendency.positionBidMultipliers ?? {}).length > 0
      || Object.keys(tendency.nominationPositionWeights ?? {}).length > 0) {
      return malformedSnapshot();
    }
    return;
  }
  if (profile.targetLabel !== `${profile.targetPosition} focus`
    || !isExactTargetMap(tendency.positionBidMultipliers, profile.targetPosition)
    || !isExactTargetMap(tendency.nominationPositionWeights, profile.targetPosition)
    || tendency.positionBidMultipliers?.[profile.targetPosition]
      !== tendency.nominationPositionWeights?.[profile.targetPosition]) {
    return malformedSnapshot();
  }
};

export const assertManagerProfileConsistency = (
  profile: ManagerDraftProfileSnapshot,
): void => {
  if (profile.sample.comparablePurchaseCount > profile.sample.auctionPurchaseCount) {
    return malformedSnapshot();
  }
  if (profile.status === "insufficient-history") {
    if (profile.confidence !== null || profile.targetPosition !== null
      || profile.targetLabel !== null || profile.premiumVsLeagueBaselinePercent !== null
      || profile.starBidding !== null || profile.aiTendency !== undefined) {
      return malformedSnapshot();
    }
    return;
  }
  if (profile.sample.seasonCount < managerProfileMinimumSeasons
    || profile.sample.auctionPurchaseCount < managerProfileMinimumPurchases
    || profile.confidence !== managerProfileConfidenceFor(profile.sample.seasonCount)
    || (profile.premiumVsLeagueBaselinePercent !== null
      && profile.sample.comparablePurchaseCount < managerProfileMinimumComparablePurchases)
    || profile.starBidding === null || profile.aiTendency === undefined
    || profile.starBidding !== expectedStarBidding(profile.aiTendency)) {
    return malformedSnapshot();
  }
  assertTargetConsistency(profile);
};
