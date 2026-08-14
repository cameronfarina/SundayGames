import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { HistoricalWeights } from "./contracts.js";

const oneDecimal = 10;

export const roundToOneDecimal = (value: number): number =>
  Math.round((value + Number.EPSILON) * oneDecimal) / oneDecimal;

export const weightedSum = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights,
  valueForSeason: (records: readonly HistoricalAuctionRecord[]) => number,
): number => Object.entries(weights).reduce((total, [season, weight]) => {
  const seasonRecords = records.filter(record => record.season === Number(season));
  return total + weight * valueForSeason(seasonRecords);
}, 0);
