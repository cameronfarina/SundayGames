import { auctionContextUnavailableWarning } from "./constants.js";
import type {
  CalibrationResult,
  CreateLeagueCalibratedPricingSnapshotsInput,
  LeagueAuctionAllocation,
} from "./contracts.js";
import {
  clampWholeDollars,
  isNonNegativeInteger,
  isPositiveInteger,
} from "./helpers.js";
import { allocateWholeDollars } from "./allocationMath.js";

export const baselineAllocation = (
  calibratedPrices: readonly CalibrationResult[],
  warning: string,
): LeagueAuctionAllocation => ({
  scenarioPrices: calibratedPrices.map(calibration => calibration.price),
  warnings: [warning],
});

const allocationWeights = (
  selectedIndexes: readonly number[],
  calibratedPrices: readonly CalibrationResult[],
  minimumBidDollars: number,
): readonly number[] => selectedIndexes.map(index =>
  Math.max(0, (calibratedPrices[index]?.price ?? 0) - minimumBidDollars));

export const fullBudgetAllocation = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  calibratedPrices: readonly CalibrationResult[],
  keeperCount: number,
  keeperLockedSpend: number,
): LeagueAuctionAllocation => {
  const teamCount = input.currentTeamCount;
  const auctionBudget = input.currentAuctionBudget;
  const rosterSize = input.currentRosterSize;
  const minimumBidDollars = input.currentMinimumBidDollars;
  if (
    !isPositiveInteger(teamCount) ||
    !isPositiveInteger(auctionBudget) ||
    !isPositiveInteger(rosterSize) ||
    !isPositiveInteger(minimumBidDollars) ||
    minimumBidDollars > auctionBudget ||
    !isNonNegativeInteger(keeperCount) ||
    !isNonNegativeInteger(keeperLockedSpend)
  ) return baselineAllocation(calibratedPrices, auctionContextUnavailableWarning);
  const totalRosterSlots = teamCount * rosterSize;
  if (keeperCount > totalRosterSlots) {
    return baselineAllocation(
      calibratedPrices,
      "league auction allocation unavailable; keeper count exceeds roster capacity",
    );
  }
  const openRosterSlots = totalRosterSlots - keeperCount;
  if (calibratedPrices.length < openRosterSlots) {
    return baselineAllocation(
      calibratedPrices,
      `league auction allocation unavailable; ${calibratedPrices.length} players cannot fill ${openRosterSlots} open roster slots`,
    );
  }
  const totalLeagueBudget = teamCount * auctionBudget;
  const availableDollars = clampWholeDollars(
    totalLeagueBudget - keeperLockedSpend,
    totalLeagueBudget,
  );
  const minimumBidReserve = openRosterSlots * minimumBidDollars;
  if (availableDollars < minimumBidReserve) {
    return baselineAllocation(
      calibratedPrices,
      `league auction allocation unavailable; $${availableDollars} remaining cannot cover the $${minimumBidReserve} minimum-bid reserve`,
    );
  }
  const selectedIndexes = calibratedPrices
    .map((calibration, index) => ({ index, price: calibration.price }))
    .sort((left, right) => right.price - left.price || left.index - right.index)
    .slice(0, openRosterSlots)
    .map(({ index }) => index);
  const discretionaryAllocation = allocateWholeDollars(
    allocationWeights(selectedIndexes, calibratedPrices, minimumBidDollars),
    availableDollars - minimumBidReserve,
    auctionBudget - minimumBidDollars,
  );
  const scenarioPrices = calibratedPrices.map(() => 0);
  selectedIndexes.forEach((playerIndex, selectionIndex) => {
    scenarioPrices[playerIndex] = minimumBidDollars +
      (discretionaryAllocation.allocations[selectionIndex] ?? 0);
  });
  return {
    scenarioPrices,
    warnings: [
      ...(keeperCount > 0 ? [
        "keeper identities unavailable; auction allocation assumes the baseline catalog contains only available players",
        "keeper team distribution unavailable; keeper spend is calibrated at league-pool level",
      ] : []),
      ...(discretionaryAllocation.unallocatedDollars > 0 ? [
        `$${discretionaryAllocation.unallocatedDollars} could not be allocated within per-player budget limits`,
      ] : []),
    ],
  };
};
