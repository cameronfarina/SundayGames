import type { HistoricalSaleRecord } from "../historicalImports.js";
import {
  maximumHistoricalRatio,
  minimumHistoricalRatio,
  recentSeasonCount,
} from "./constants.js";
import { addMapValue, playerHistoryKey } from "./helpers.js";

export const recentAuctionSales = (
  records: readonly HistoricalSaleRecord[],
  leagueId: string,
  seasonYear: number | string,
): readonly HistoricalSaleRecord[] => {
  const currentSeasonYear = Number(seasonYear);
  const eligible = records.filter(record =>
    record.leagueId === leagueId &&
    (!Number.isFinite(currentSeasonYear) || record.seasonYear <= currentSeasonYear) &&
    record.acquisitionType === "auction" &&
    !record.keeper &&
    Number.isFinite(record.priceDollars) &&
    record.priceDollars >= 0);
  const latestSeasonYear = Math.max(...eligible.map(record => record.seasonYear));
  if (!Number.isFinite(latestSeasonYear)) return [];
  const oldestIncludedSeasonYear = latestSeasonYear - recentSeasonCount + 1;
  return eligible.filter(record => record.seasonYear >= oldestIncludedSeasonYear);
};

export const createPlayerHistory = (
  sales: readonly HistoricalSaleRecord[],
): ReadonlyMap<string, number[]> => {
  const history = new Map<string, number[]>();
  for (const sale of sales) {
    if (sale.publicPriceDollars === undefined || sale.publicPriceDollars <= 0) continue;
    const ratio = Math.min(
      maximumHistoricalRatio,
      Math.max(minimumHistoricalRatio, sale.priceDollars / sale.publicPriceDollars),
    );
    addMapValue(history, playerHistoryKey(sale.playerName, sale.position), ratio);
  }
  return history;
};
