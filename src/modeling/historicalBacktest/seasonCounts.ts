import { ownerOrder, positions } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { highPriceThresholds, priceTiers } from "./constants.js";
import type {
  HistoricalCountSummary,
  HistoricalPriceTier,
  OwnerAmounts,
  PositionAmounts,
} from "./contracts.js";
import { auctionRecords, seasonAverage, sumPrices } from "./records.js";

const inTier = (price: number, tier: HistoricalPriceTier): boolean =>
  price >= tier.minPrice && (tier.maxPrice === undefined || price <= tier.maxPrice);

export const highPriceCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalCountSummary[] => highPriceThresholds.map(threshold => ({
  key: `${threshold}-plus`,
  label: `$${threshold}+`,
  count: seasonAverage(records, seasons, seasonRecords =>
    auctionRecords(seasonRecords).filter(record => record.price >= threshold).length),
}));

export const priceTierCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalCountSummary[] => priceTiers.map(tier => ({
  key: tier.key,
  label: tier.label,
  count: seasonAverage(records, seasons, seasonRecords =>
    auctionRecords(seasonRecords).filter(record => inTier(record.price, tier)).length),
}));

export const positionCounts = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): PositionAmounts => {
  const counts: PositionAmounts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const position of positions) {
    counts[position] = seasonAverage(records, seasons, seasonRecords =>
      seasonRecords.filter(record => record.position === position).length);
  }
  return counts;
};

export const positionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): PositionAmounts => {
  const spend: PositionAmounts = { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 };
  for (const position of positions) {
    spend[position] = seasonAverage(records, seasons, seasonRecords =>
      sumPrices(auctionRecords(seasonRecords).filter(record => record.position === position)));
  }
  return spend;
};

export const ownerSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): OwnerAmounts => {
  const spend: OwnerAmounts = {};
  for (const owner of ownerOrder) {
    spend[owner] = seasonAverage(records, seasons, seasonRecords =>
      sumPrices(auctionRecords(seasonRecords).filter(record => record.owner === owner)));
  }
  return spend;
};
