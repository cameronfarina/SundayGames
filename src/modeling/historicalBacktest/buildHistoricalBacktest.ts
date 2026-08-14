import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { aggregateSummary } from "./aggregateSummary.js";
import type { HistoricalBacktestReport, HistoricalSeasonBacktest } from "./contracts.js";
import { gatesFor } from "./gatesFor.js";
import { historicalSeasons } from "./records.js";
import { seasonShape } from "./seasonShape.js";

const notes = [
  "Backtest compares historical seasons against other historical seasons only; it does not claim projection accuracy without historical projection files.",
  "Auction spend, price tiers, high-price volume, position spend, and owner spend use open-auction records; roster position counts include the normalized full board.",
  "Warnings mark historically noisy areas to review before changing model weights; failures mark economics that should not be treated as stable without more data.",
];

const seasonBacktest = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  season: number,
): HistoricalSeasonBacktest => {
  const sourceSeasons = seasons.filter(candidate => candidate !== season);
  const actual = seasonShape(records, [season]);
  const baseline = seasonShape(records, sourceSeasons);
  return { season, sourceSeasons, actual, baseline, gates: gatesFor(actual, baseline) };
};

export const buildHistoricalBacktest = (
  historicalRecords: readonly HistoricalAuctionRecord[],
): HistoricalBacktestReport => {
  const seasons = historicalSeasons(historicalRecords);
  if (seasons.length < 2) throw new Error("Historical backtest requires at least two seasons.");
  const seasonBacktests = seasons.map(season => seasonBacktest(historicalRecords, seasons, season));
  return {
    method: "leave-one-season-out",
    historicalSeasons: seasons,
    summary: aggregateSummary(seasonBacktests),
    seasonBacktests,
    notes: [...notes],
  };
};
