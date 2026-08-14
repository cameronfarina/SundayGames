import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { ScenarioAdjustedPrice } from "../keeperInflation.js";
import type { MockRun } from "../mockBatch.js";
import { highPriceThresholds } from "./constants.js";
import type { HighPriceVolumeSanity } from "./contracts.js";
import { average, maximum, roundToTwo } from "./math.js";

export const highPriceVolumeFor = (
  historicalRecords: readonly HistoricalAuctionRecord[],
  availablePrices: readonly ScenarioAdjustedPrice[],
  runs: readonly MockRun[],
): HighPriceVolumeSanity[] => {
  const auctionRecords = historicalRecords.filter(record => record.acquisitionType === "auction");
  const seasons = [...new Set(historicalRecords.map(record => record.season))]
    .sort((left, right) => left - right);

  return highPriceThresholds.map(threshold => {
    const historicalCounts = seasons.map(season =>
      auctionRecords.filter(record => record.season === season && record.price >= threshold).length);
    const mockCounts = runs.map(run => run.picks.filter(pick => pick.price >= threshold).length);
    const scenarioCount = availablePrices.filter(price => price.scenarioPrice >= threshold).length;
    const mockMaxCount = maximum(mockCounts);
    const historicalMaxCount = maximum(historicalCounts);
    return {
      threshold,
      historicalAverageCount: roundToTwo(average(historicalCounts)),
      historicalMaxCount,
      scenarioCount,
      mockAverageCount: roundToTwo(average(mockCounts)),
      mockMaxCount,
      status: scenarioCount > historicalMaxCount || mockMaxCount > historicalMaxCount
        ? "review"
        : "pass",
    };
  });
};
