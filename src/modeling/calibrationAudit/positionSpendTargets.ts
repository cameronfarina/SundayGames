import { positions, type Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { defaultKeeperScenarioConfig } from "../keeperInflation.js";
import type { MockRun } from "../mockBatch.js";
import {
  averageScenarioKeeperCount,
  historicalPositionSpend,
  historicalTopAuctionSpendForCount,
} from "./positionSpendMetrics.js";

export type PositionAmounts = Record<Position, number>;

const redistributeRemovedKeeperSpend = (
  baseTargets: PositionAmounts,
  removedTargets: PositionAmounts,
): PositionAmounts => {
  const adjustedTargets = { ...baseTargets };
  const removedTotal = positions.reduce(
    (total, position) => total + removedTargets[position],
    0,
  );
  if (removedTotal <= 0) return adjustedTargets;

  const redistributionPositions = positions.filter(
    position => removedTargets[position] === 0,
  );
  const fallbackPositions = redistributionPositions.length === 0
    ? [...positions]
    : redistributionPositions;
  const redistributionWeightTotal = fallbackPositions.reduce(
    (total, position) => total + baseTargets[position],
    0,
  );
  if (redistributionWeightTotal <= 0) return adjustedTargets;

  for (const position of positions) {
    adjustedTargets[position] = Math.max(
      0,
      baseTargets[position] - removedTargets[position],
    );
  }
  for (const position of fallbackPositions) {
    adjustedTargets[position] +=
      removedTotal * (baseTargets[position] / redistributionWeightTotal);
  }

  return adjustedTargets;
};

export const keeperAdjustedPositionSpendTargets = (
  records: readonly HistoricalAuctionRecord[],
  runs: readonly MockRun[],
  seasons: readonly number[],
  scenarioSpendScale: number,
): PositionAmounts => {
  const baseTargets = positions.reduce<PositionAmounts>(
    (targets, position) => ({
      ...targets,
      [position]: historicalPositionSpend(records, seasons, position) * scenarioSpendScale,
    }),
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );
  const removedTargets = positions.reduce<PositionAmounts>(
    (targets, position) => {
      const extraKeeperCount = Math.max(
        0,
        averageScenarioKeeperCount(runs, position) -
          defaultKeeperScenarioConfig.typicalKeeperCounts[position],
      );
      const opportunitySpend = historicalTopAuctionSpendForCount(
        records,
        seasons,
        position,
        extraKeeperCount,
      );

      return {
        ...targets,
        [position]: Math.min(
          baseTargets[position],
          opportunitySpend * scenarioSpendScale,
        ),
      };
    },
    { QB: 0, RB: 0, WR: 0, TE: 0, K: 0, DST: 0 },
  );

  return redistributeRemovedKeeperSpend(baseTargets, removedTargets);
};
