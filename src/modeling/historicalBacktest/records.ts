import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";

export const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const average = (values: readonly number[]): number =>
  values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

export const historicalSeasons = (
  records: readonly HistoricalAuctionRecord[],
): number[] => [...new Set(records.map(record => record.season))].sort((left, right) => left - right);

export const auctionRecords = (
  records: readonly HistoricalAuctionRecord[],
): HistoricalAuctionRecord[] => records.filter(record => record.acquisitionType === "auction");

export const recordsForSeason = (
  records: readonly HistoricalAuctionRecord[],
  season: number,
): HistoricalAuctionRecord[] => records.filter(record => record.season === season);

export const sumPrices = (records: readonly HistoricalAuctionRecord[]): number =>
  records.reduce((total, record) => total + record.price, 0);

export const seasonAverage = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  valueForSeason: (seasonRecords: HistoricalAuctionRecord[]) => number,
): number => roundToTwo(average(seasons.map(season => valueForSeason(recordsForSeason(records, season)))));
