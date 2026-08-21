import type {
  ManagerDraftProfileConfidence,
  ManagerDraftProfileStarBidding,
  ManagerDraftProfileTargetPosition,
} from "./contracts.js";

export const managerProfileMinimumPurchases = 8;
export const managerProfileMinimumSeasons = 2;
export const managerProfileMinimumComparablePurchases = 6;
export const managerProfileMinimumTargetLift = 1.15;
export const managerProfileMaximumTargetLift = 1.25;
export const managerProfileMinimumPremiumMultiplier = 0.4;
export const managerProfileMaximumPremiumMultiplier = 1.3;

export const managerProfileConfidenceFor = (
  seasonCount: number,
): ManagerDraftProfileConfidence | null => {
  if (seasonCount >= 4) return "strong";
  if (seasonCount === 3) return "established";
  return seasonCount >= managerProfileMinimumSeasons ? "limited" : null;
};

export const managerProfileStarBiddingFor = (
  multiplier: number,
): ManagerDraftProfileStarBidding => {
  if (multiplier < 0.9) return "low";
  return multiplier > 1.1 ? "high" : "typical";
};

export const managerProfileTargetLabelFor = (
  hasPeerEvidence: boolean,
  target: ManagerDraftProfileTargetPosition | undefined,
): string | null => {
  if (!hasPeerEvidence) return null;
  return target === undefined ? "Balanced" : `${target} focus`;
};
