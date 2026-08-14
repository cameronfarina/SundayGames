import { ownerOrder, type Owner } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import type { OwnerSpendCalibration } from "./contracts/calibration.js";
import { average, roundToTwo } from "./numeric.js";

const topTwoSpend = (prices: readonly number[]): number =>
  [...prices]
    .sort((left, right) => right - left)
    .slice(0, 2)
    .reduce((total, price) => total + price, 0);

const historicalOwnerAuctionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  owner: Owner,
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season && record.owner === owner)
      .reduce((total, record) => total + record.price, 0),
  ));

const historicalOwnerTopTwoSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  owner: Owner,
): number =>
  average(seasons.map(season =>
    topTwoSpend(records
      .filter(record => record.season === season && record.owner === owner)
      .map(record => record.price)),
  ));

const mockOwnerAuctionSpendForRun = (run: MockRun, owner: Owner): number =>
  run.picks
    .filter(pick => pick.owner === owner)
    .reduce((total, pick) => total + pick.price, 0);

const mockOwnerAuctionSpend = (runs: readonly MockRun[], owner: Owner): number =>
  average(runs.map(run => mockOwnerAuctionSpendForRun(run, owner)));

const scenarioOwnerOpenAuctionBudget = (
  runs: readonly MockRun[],
  owner: Owner,
): number =>
  average(runs.map(run => {
    const roster = run.rosters.find(summary => summary.owner === owner);
    if (!roster) throw new Error(`Missing roster summary for ${owner}.`);

    return mockOwnerAuctionSpendForRun(run, owner) + roster.budgetRemaining;
  }));

const mockOwnerTopTwoSpend = (runs: readonly MockRun[], owner: Owner): number =>
  average(runs.map(run =>
    topTwoSpend(run.picks
      .filter(pick => pick.owner === owner)
      .map(pick => pick.price)),
  ));

export const summarizeOwnerSpend = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): OwnerSpendCalibration[] =>
  ownerOrder.map(owner => {
    const historicalAverageAuctionSpend = roundToTwo(
      historicalOwnerAuctionSpend(records, seasons, owner),
    );
    const scenarioAverageOpenAuctionBudget = roundToTwo(
      scenarioOwnerOpenAuctionBudget(runs, owner),
    );
    const mockAverageAuctionSpend = roundToTwo(mockOwnerAuctionSpend(runs, owner));
    const historicalAverageTopTwoAuctionSpend = roundToTwo(
      historicalOwnerTopTwoSpend(records, seasons, owner),
    );
    const mockAverageTopTwoAuctionSpend = roundToTwo(
      mockOwnerTopTwoSpend(runs, owner),
    );

    return {
      owner,
      historicalAverageAuctionSpend,
      scenarioAverageOpenAuctionBudget,
      mockAverageAuctionSpend,
      spendDelta: roundToTwo(mockAverageAuctionSpend - historicalAverageAuctionSpend),
      scenarioSpendDelta: roundToTwo(
        mockAverageAuctionSpend - scenarioAverageOpenAuctionBudget,
      ),
      historicalAverageTopTwoAuctionSpend,
      mockAverageTopTwoAuctionSpend,
      topTwoDelta: roundToTwo(
        mockAverageTopTwoAuctionSpend - historicalAverageTopTwoAuctionSpend,
      ),
    };
  });
