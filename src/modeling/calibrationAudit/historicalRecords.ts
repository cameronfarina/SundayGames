import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { average } from "./numeric.js";

export const openAuctionRecords = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] =>
  historicalRecords.filter(record => record.acquisitionType === "auction");

export const historicalSeasons = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): number[] =>
  [...new Set(historicalRecords.map(record => record.season))]
    .sort((left, right) => left - right);

export const averageHistoricalCountPerSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season =>
    records.filter(record => record.season === season).length,
  ));
