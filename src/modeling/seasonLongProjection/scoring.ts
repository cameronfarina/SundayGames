import type {
  RushingReceivingSeasonStatLine,
  SeasonProjectionScoring,
  SeasonProjectionScoringBreakdown,
} from "./contracts.js";

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

export const fantasyPointsForSeasonStatLine = (
  stats: RushingReceivingSeasonStatLine,
  scoring: SeasonProjectionScoring,
): SeasonProjectionScoringBreakdown => {
  const breakdown = {
    rushingYards: roundToTwo(stats.rushingYards * scoring.rushingYards),
    rushingTouchdowns: roundToTwo(stats.rushingTouchdowns * scoring.rushingTouchdown),
    receptions: roundToTwo(stats.receptions * scoring.reception),
    receivingYards: roundToTwo(stats.receivingYards * scoring.receivingYards),
    receivingTouchdowns: roundToTwo(stats.receivingTouchdowns * scoring.receivingTouchdown),
  };

  return {
    ...breakdown,
    total: roundToTwo(Object.values(breakdown).reduce((sum, value) => sum + value, 0)),
  };
};
