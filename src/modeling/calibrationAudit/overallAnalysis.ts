import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import type { OverallCalibration } from "./contracts/calibration.js";
import { average, roundToTwo } from "./numeric.js";

export const totalHistoricalAuctionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season)
      .reduce((total, record) => total + record.price, 0),
  ));

export const totalMockAuctionSpend = (runs: readonly MockRun[]): number =>
  average(runs.map(run =>
    run.picks.reduce((total, pick) => total + pick.price, 0),
  ));

export const scenarioOpenAuctionDollars = (runs: readonly MockRun[]): number =>
  average(runs.map(run => run.keeperScenario.openAuctionDollars));

const dollarPlayersPerHistoricalSeason = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
): number =>
  average(seasons.map(season =>
    records.filter(record => record.season === season && record.price === 1).length,
  ));

const dollarPlayersPerMockRun = (runs: readonly MockRun[]): number =>
  average(runs.map(run => run.picks.filter(pick => pick.price === 1).length));

export const summarizeOverall = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): OverallCalibration => {
  const historicalAverageAuctionSpend = roundToTwo(
    totalHistoricalAuctionSpend(records, seasons),
  );
  const scenarioAverageOpenAuctionDollars = roundToTwo(scenarioOpenAuctionDollars(runs));
  const mockAverageAuctionSpend = roundToTwo(totalMockAuctionSpend(runs));
  const historicalAverageDollarPlayers = roundToTwo(
    dollarPlayersPerHistoricalSeason(records, seasons),
  );
  const mockAverageDollarPlayers = roundToTwo(dollarPlayersPerMockRun(runs));

  return {
    historicalAverageAuctionSpend,
    scenarioAverageOpenAuctionDollars,
    mockAverageAuctionSpend,
    auctionSpendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
    scenarioAuctionSpendDelta: roundToTwo(
      mockAverageAuctionSpend - scenarioAverageOpenAuctionDollars,
    ),
    historicalAverageDollarPlayers,
    mockAverageDollarPlayers,
    dollarPlayerDelta: roundToTwo(
      mockAverageDollarPlayers - historicalAverageDollarPlayers,
    ),
  };
};
