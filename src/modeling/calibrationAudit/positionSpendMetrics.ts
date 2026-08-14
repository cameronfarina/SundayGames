import type { Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import { average } from "./numeric.js";

export const historicalPositionSpend = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
): number =>
  average(seasons.map(season =>
    records
      .filter(record => record.season === season && record.position === position)
      .reduce((total, record) => total + record.price, 0),
  ));

export const mockPositionSpend = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run =>
    run.picks
      .filter(pick => pick.position === position)
      .reduce((total, pick) => total + pick.price, 0),
  ));

export const averageScenarioKeeperCount = (
  runs: readonly MockRun[],
  position: Position,
): number =>
  average(runs.map(run => run.keeperScenario.keeperCounts[position]));

export const historicalTopAuctionSpendForCount = (
  records: readonly HistoricalAuctionRecord[],
  seasons: readonly number[],
  position: Position,
  count: number,
): number => {
  if (count <= 0) return 0;

  const fullCount = Math.floor(count);
  const fractionalCount = count - fullCount;

  return average(seasons.map(season => {
    const prices = records
      .filter(record => record.season === season && record.position === position)
      .map(record => record.price)
      .sort((left, right) => right - left);
    const fullSpend = prices
      .slice(0, fullCount)
      .reduce((total, price) => total + price, 0);
    const fractionalSpend = (prices[fullCount] ?? 0) * fractionalCount;

    return fullSpend + fractionalSpend;
  }));
};
