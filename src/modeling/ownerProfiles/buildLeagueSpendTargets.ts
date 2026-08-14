import { positions } from "../../../config/league.js";
import type { Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import {
  defaultHistoricalWeights,
  profilePositions,
  specialTeamsPositions,
} from "./constants.js";
import type {
  HistoricalWeights,
  LeagueOpenAuctionSpendTargets,
} from "./contracts.js";
import {
  auctionRecords,
  normalSpecialTeamsSpend,
  spendForPosition,
} from "./recordMetrics.js";
import { roundToOneDecimal, weightedSum } from "./weighting.js";

const emptySpendTargets = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});

export const buildLeagueOpenAuctionSpendTargets = (
  records: readonly HistoricalAuctionRecord[],
  weights: HistoricalWeights = defaultHistoricalWeights,
): LeagueOpenAuctionSpendTargets => {
  const byPosition = emptySpendTargets();
  for (const position of profilePositions) {
    byPosition[position] = roundToOneDecimal(
      weightedSum(records, weights, seasonRecords =>
        spendForPosition(auctionRecords(seasonRecords), position)),
    );
  }

  const specialTeamsSpend = roundToOneDecimal(
    weightedSum(records, weights, normalSpecialTeamsSpend),
  );
  const balancedSpend = roundToOneDecimal(specialTeamsSpend / specialTeamsPositions.length);
  byPosition.K = balancedSpend;
  byPosition.DST = balancedSpend;

  return {
    byPosition,
    total: roundToOneDecimal(positions.reduce((total, position) => total + byPosition[position], 0)),
  };
};
