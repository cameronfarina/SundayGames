import type { GenericAuctionMockAiTendency } from "../../genericAuctionMockEngine.js";
import type {
  ManagerDraftProfileConfidence,
  ManagerDraftProfileSnapshot,
  ManagerDraftProfileStarBidding,
  ManagerDraftProfileTargetPosition,
} from "../../managerDraftProfiles.js";
import { malformedSnapshot } from "../errors.js";
import { assertManagerProfileConsistency } from "./managerProfileConsistency.js";
import {
  arrayValue,
  finiteNumber,
  nonEmptyString,
  nonNegativeInteger,
  numberRecord,
  plainRecord,
} from "./primitives.js";

const confidenceValue = (value: unknown): ManagerDraftProfileConfidence | null => {
  if (value === null) return null;
  if (value === "limited" || value === "established" || value === "strong") return value;
  return malformedSnapshot();
};

const targetPositionValue = (value: unknown): ManagerDraftProfileTargetPosition | null => {
  if (value === null) return null;
  if (value === "QB" || value === "RB" || value === "WR" || value === "TE") return value;
  return malformedSnapshot();
};

const starBiddingValue = (value: unknown): ManagerDraftProfileStarBidding | null => {
  if (value === null) return null;
  if (value === "low" || value === "typical" || value === "high") return value;
  return malformedSnapshot();
};

const aiTendencyValue = (value: unknown): GenericAuctionMockAiTendency | undefined => {
  if (value === undefined) return undefined;
  const record = plainRecord(value);
  return {
    ...(record.premiumBidMultiplier === undefined ? {} : {
      premiumBidMultiplier: finiteNumber(record.premiumBidMultiplier),
    }),
    ...(record.positionBidMultipliers === undefined ? {} : {
      positionBidMultipliers: numberRecord(record.positionBidMultipliers, false),
    }),
    ...(record.nominationPositionWeights === undefined ? {} : {
      nominationPositionWeights: numberRecord(record.nominationPositionWeights, false),
    }),
  };
};

const profileValue = (value: unknown): ManagerDraftProfileSnapshot => {
  const record = plainRecord(value);
  const status = record.status === "ready" || record.status === "insufficient-history"
    ? record.status
    : malformedSnapshot();
  const sample = plainRecord(record.sample);
  const aiTendency = aiTendencyValue(record.aiTendency);
  const profile: ManagerDraftProfileSnapshot = {
    teamId: nonEmptyString(record.teamId),
    status,
    sample: {
      seasonCount: nonNegativeInteger(sample.seasonCount),
      auctionPurchaseCount: nonNegativeInteger(sample.auctionPurchaseCount),
      comparablePurchaseCount: nonNegativeInteger(sample.comparablePurchaseCount),
    },
    confidence: confidenceValue(record.confidence),
    targetPosition: targetPositionValue(record.targetPosition),
    targetLabel: record.targetLabel === null ? null : nonEmptyString(record.targetLabel),
    premiumVsLeagueBaselinePercent: record.premiumVsLeagueBaselinePercent === null
      ? null
      : finiteNumber(record.premiumVsLeagueBaselinePercent),
    starBidding: starBiddingValue(record.starBidding),
    ...(aiTendency === undefined ? {} : { aiTendency }),
  };
  assertManagerProfileConsistency(profile);
  return profile;
};

export const managerProfilesValue = (
  value: unknown,
): readonly ManagerDraftProfileSnapshot[] => value === undefined
  ? []
  : arrayValue(value).map(profileValue);
