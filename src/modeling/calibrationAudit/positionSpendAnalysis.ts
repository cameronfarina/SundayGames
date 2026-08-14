import { positions } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import type { MockRun } from "../mockBatch.js";
import type { PositionSpendCalibration } from "./contracts/calibration.js";
import { roundToTwo } from "./numeric.js";
import {
  scenarioOpenAuctionDollars,
  totalHistoricalAuctionSpend,
} from "./overallAnalysis.js";
import {
  historicalPositionSpend,
  mockPositionSpend,
} from "./positionSpendMetrics.js";
import { keeperAdjustedPositionSpendTargets } from "./positionSpendTargets.js";

export const summarizePositionSpend = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
): PositionSpendCalibration[] => {
  const historicalAverageAuctionSpend = totalHistoricalAuctionSpend(records, seasons);
  const scenarioAverageOpenAuctionDollars = scenarioOpenAuctionDollars(runs);
  const scenarioSpendScale = historicalAverageAuctionSpend === 0
    ? 1
    : scenarioAverageOpenAuctionDollars / historicalAverageAuctionSpend;
  const scenarioSpendTargets = keeperAdjustedPositionSpendTargets(
    records,
    runs,
    seasons,
    scenarioSpendScale,
  );

  return positions.map(position => {
    const historicalAverageSpend = roundToTwo(
      historicalPositionSpend(records, seasons, position),
    );
    const scenarioAverageSpendTarget = roundToTwo(scenarioSpendTargets[position]);
    const mockAverageSpend = roundToTwo(mockPositionSpend(runs, position));

    return {
      position,
      historicalAverageSpend,
      scenarioAverageSpendTarget,
      mockAverageSpend,
      delta: roundToTwo(mockAverageSpend - historicalAverageSpend),
      scenarioSpendDelta: roundToTwo(
        mockAverageSpend - scenarioAverageSpendTarget,
      ),
    };
  });
};
