import { positions, type Position } from "../../../config/league.js";
import type { OwnerProfile } from "../ownerProfiles.js";
import { OwnerAuctionBehaviors, OwnerDemandMultipliers } from "./configContracts.js";
import { emptyPositionAmounts } from "./constants.js";
import { average, clamp } from "./coreMath.js";

export const ownerProfileSpendFor = (
  profile: OwnerProfile,
  position: Position,
): number => {
  if (position === "K" || position === "DST") return profile.normalSpecialTeamsSpend / 2;
  return profile.openAuctionSpend[position];
};

export const buildOwnerDemandMultipliers = (
  profiles: readonly OwnerProfile[],
): OwnerDemandMultipliers => {
  const leagueAverages = emptyPositionAmounts();
  const multipliersByOwner: OwnerDemandMultipliers = {};

  for (const position of positions) {
    const totalSpend = profiles.reduce(
      (total, profile) => total + ownerProfileSpendFor(profile, position),
      0,
    );
    leagueAverages[position] = totalSpend / Math.max(1, profiles.length);
  }

  for (const profile of profiles) {
    const multipliers: Partial<Record<Position, number>> = {};

    for (const position of positions) {
      const averageSpend = leagueAverages[position];
      if (averageSpend <= 0) {
        multipliers[position] = 1;
        continue;
      }

      const demandRatio = ownerProfileSpendFor(profile, position) / averageSpend;
      multipliers[position] = clamp(1 + (demandRatio - 1) * 0.12, 0.9, 1.12);
    }

    multipliersByOwner[profile.owner] = multipliers;
  }

  return multipliersByOwner;
};

export const buildOwnerAuctionBehaviors = (
  profiles: readonly OwnerProfile[],
): OwnerAuctionBehaviors => {
  const averageTopTwoConcentration = average(profiles.map(profile => profile.topTwoConcentration));
  const averageOneDollarCount = average(profiles.map(profile => profile.oneDollarPlayerCount));
  const behaviors: OwnerAuctionBehaviors = {};

  for (const profile of profiles) {
    const concentrationDelta = profile.topTwoConcentration - averageTopTwoConcentration;
    const oneDollarDelta = profile.oneDollarPlayerCount - averageOneDollarCount;

    behaviors[profile.owner] = {
      priceAggression: clamp(1 + concentrationDelta * 0.003, 0.94, 1.08),
      scarcityChase: clamp(1 + concentrationDelta * 0.006, 0.9, 1.15),
      replacementPatience: clamp(1 - oneDollarDelta * 0.02, 0.92, 1.05),
      anchorAggression: clamp(1 + concentrationDelta * 0.004, 0.94, 1.1),
      depthAggression: clamp(1 - concentrationDelta * 0.003 - oneDollarDelta * 0.01, 0.9, 1.08),
    };
  }

  return behaviors;
};
