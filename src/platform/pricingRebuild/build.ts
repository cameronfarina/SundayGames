import {
  createPricingInputSnapshot,
  createPricingSnapshot,
  type PricingSnapshot,
} from "../pricingSnapshots.js";
import {
  calibratedMarketPrice,
  historyWarningsFor,
  sourcePriceForScenario,
} from "./calibration.js";
import {
  balancedScenarioId,
  scenarioAssumptionsUnavailableWarning,
} from "./constants.js";
import type { CreateLeagueCalibratedPricingSnapshotsInput } from "./contracts.js";
import { createPlayerHistory, recentAuctionSales } from "./history.js";
import { isPositiveInteger, normalizedScenarioIds } from "./helpers.js";
import { leagueAuctionAllocation } from "./leagueAllocation.js";
import {
  createPositionInflationMultipliers,
  createPositionSaleCurves,
  historicalRankPricesForBaselines,
} from "./positionHistory.js";
import { inputSnapshotPayload } from "./snapshotPayload.js";

export const createLeagueCalibratedPricingSnapshots = (
  input: CreateLeagueCalibratedPricingSnapshotsInput,
): readonly PricingSnapshot[] => {
  const scenarioIds = normalizedScenarioIds(input.scenarioIds);
  const recentSales = recentAuctionSales(
    input.historicalSaleRecords,
    input.leagueId,
    input.seasonYear,
  );
  const playerHistory = createPlayerHistory(recentSales);
  const positionInflation = createPositionInflationMultipliers(recentSales);
  const historicalRankPrices = historicalRankPricesForBaselines(
    input.baselinePrices,
    createPositionSaleCurves(recentSales),
  );
  const maximumPrice = isPositiveInteger(input.currentAuctionBudget)
    ? input.currentAuctionBudget
    : Number.POSITIVE_INFINITY;
  const calibratedPrices = input.baselinePrices.map((price, index) =>
    calibratedMarketPrice(
      price,
      playerHistory,
      positionInflation.multipliers,
      positionInflation.publicValueCoverage,
      historicalRankPrices.get(index),
      maximumPrice,
    ));
  const auctionAllocation = leagueAuctionAllocation(
    input,
    calibratedPrices,
    recentSales.length > 0,
  );
  const historyWarnings = historyWarningsFor(
    recentSales.length,
    positionInflation.matchedSaleCount,
  );
  const inputSnapshot = createPricingInputSnapshot(
    inputSnapshotPayload(input, recentSales),
  );
  return scenarioIds.map(scenarioId => createPricingSnapshot({
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    scenarioId,
    inputSnapshot,
    prices: input.baselinePrices.map((price, index) => sourcePriceForScenario(
      price,
      calibratedPrices[index] ?? { price: 0, historicalMove: 0 },
      auctionAllocation.scenarioPrices[index] ?? 0,
      auctionAllocation.personalValues?.[index]
        ?? auctionAllocation.scenarioPrices[index]
        ?? 0,
      [
        ...historyWarnings,
        ...auctionAllocation.warnings,
        ...(scenarioId === balancedScenarioId
          ? []
          : [scenarioAssumptionsUnavailableWarning]),
      ],
    )),
    ...(input.createdAt === undefined ? {} : { createdAt: input.createdAt }),
  }));
};
