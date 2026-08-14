import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import type {
  CalibrationPriceTier,
  HighPriceVolumeCalibration,
  PriceTierCalibration,
} from "./contracts/calibration.js";
import { averageHistoricalCountPerSeason } from "./historicalRecords.js";
import { average, max, roundToTwo } from "./numeric.js";

export const priceTiers: readonly CalibrationPriceTier[] = [
  { key: "elite", label: "$60+", minPrice: 60 },
  { key: "strong", label: "$40-$59", minPrice: 40, maxPrice: 59 },
  { key: "starter", label: "$20-$39", minPrice: 20, maxPrice: 39 },
  { key: "depth", label: "$2-$19", minPrice: 2, maxPrice: 19 },
  { key: "dollar", label: "$1", minPrice: 1, maxPrice: 1 },
];

const highPriceThresholds: readonly number[] = [70, 75, 80];

const isInTier = (price: number, tier: CalibrationPriceTier): boolean =>
  price >= tier.minPrice &&
  (tier.maxPrice === undefined || price <= tier.maxPrice);

const averageMockCountPerRun = (
  runs: readonly MockRun[],
  predicate: (price: number) => boolean,
): number =>
  average(runs.map(run => run.picks.filter(pick => predicate(pick.price)).length));

export const summarizePriceTiers = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PriceTierCalibration[] =>
  priceTiers.map(tier => {
    const historicalTierRecords = records.filter(record => isInTier(record.price, tier));
    const mockTierPicks = runs.flatMap(run =>
      run.picks.filter(pick => isInTier(pick.price, tier)),
    );
    const historicalAveragePrice = roundToTwo(
      average(historicalTierRecords.map(record => record.price)),
    );
    const mockAveragePrice = roundToTwo(average(mockTierPicks.map(pick => pick.price)));
    const historicalAverageCount = roundToTwo(
      averageHistoricalCountPerSeason(historicalTierRecords, seasons),
    );
    const mockAverageCount = roundToTwo(
      averageMockCountPerRun(runs, price => isInTier(price, tier)),
    );

    return {
      key: tier.key,
      label: tier.label,
      historicalAveragePrice,
      mockAveragePrice,
      priceDelta: roundToTwo(mockAveragePrice - historicalAveragePrice),
      historicalAverageCount,
      mockAverageCount,
      countDelta: roundToTwo(mockAverageCount - historicalAverageCount),
    };
  });

const highPriceCountByHistoricalSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  threshold: number,
): number[] =>
  seasons.map(season =>
    records.filter(record =>
      record.season === season && record.price >= threshold,
    ).length,
  );

const highPriceCountByMockRun = (
  runs: readonly MockRun[],
  threshold: number,
): number[] =>
  runs.map(run => run.picks.filter(pick => pick.price >= threshold).length);

export const summarizeHighPriceVolumes = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): HighPriceVolumeCalibration[] =>
  highPriceThresholds.map(threshold => {
    const historicalCounts = highPriceCountByHistoricalSeason(records, seasons, threshold);
    const mockCounts = highPriceCountByMockRun(runs, threshold);
    const historicalAverageCount = roundToTwo(average(historicalCounts));
    const mockAverageCount = roundToTwo(average(mockCounts));
    const historicalMaxCount = max(historicalCounts);
    const mockMaxCount = max(mockCounts);

    return {
      threshold,
      label: `$${threshold}+`,
      historicalAverageCount,
      historicalMaxCount,
      mockAverageCount,
      mockMaxCount,
      averageCountDelta: roundToTwo(mockAverageCount - historicalAverageCount),
      maxCountDelta: roundToTwo(mockMaxCount - historicalMaxCount),
    };
  });
