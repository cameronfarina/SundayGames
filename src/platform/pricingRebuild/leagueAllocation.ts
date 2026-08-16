import { auctionContextUnavailableWarning } from "./constants.js";
import type {
  CalibrationResult,
  CreateLeagueCalibratedPricingSnapshotsInput,
  LeagueAuctionAllocation,
} from "./contracts.js";
import { baselineAllocation, fullBudgetAllocation } from "./fullBudgetAllocation.js";
import { keeperSavingsAllocation } from "./keeperSavingsAllocation.js";

export const leagueAuctionAllocation = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
  calibratedPrices: readonly CalibrationResult[],
  hasLeagueHistory = false,
): LeagueAuctionAllocation => {
  if (input.currentKeepers !== undefined) {
    return keeperSavingsAllocation(input, calibratedPrices, hasLeagueHistory);
  }
  const keeperLockedSpend = input.keeperLockedSpend ?? 0;
  const keeperCount = input.currentKeeperCount ??
    (keeperLockedSpend === 0 ? 0 : undefined);
  if (keeperCount === undefined) {
    return baselineAllocation(calibratedPrices, auctionContextUnavailableWarning);
  }
  return fullBudgetAllocation(input, calibratedPrices, keeperCount, keeperLockedSpend);
};
