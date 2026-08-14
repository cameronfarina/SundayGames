import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { HistoricalSeasonShape } from "./contracts.js";
import { auctionRecords, seasonAverage, sumPrices } from "./records.js";
import {
  highPriceCounts,
  ownerSpend,
  positionCounts,
  positionSpend,
  priceTierCounts,
} from "./seasonCounts.js";

export const seasonShape = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): HistoricalSeasonShape => ({
  openAuctionSpend: seasonAverage(records, seasons, seasonRecords =>
    sumPrices(auctionRecords(seasonRecords))),
  auctionPlayerCount: seasonAverage(records, seasons, seasonRecords =>
    auctionRecords(seasonRecords).length),
  dollarPlayerCount: seasonAverage(records, seasons, seasonRecords =>
    auctionRecords(seasonRecords).filter(record => record.price === 1).length),
  highPriceCounts: highPriceCounts(records, seasons),
  priceTierCounts: priceTierCounts(records, seasons),
  positionCounts: positionCounts(records, seasons),
  positionSpend: positionSpend(records, seasons),
  ownerSpend: ownerSpend(records, seasons),
});
