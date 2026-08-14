import type { MockResultsCamScoreRange } from "./analyticsContracts.js";
import { average, roundToTwo } from "./formatting.js";
import type { MockResultsRun } from "./reportContracts.js";

export const camScoreRangeFor = (runs: readonly MockResultsRun[]): MockResultsCamScoreRange => {
  const sorted = [...runs].sort(
    (left, right) =>
      right.camOutcome.seasonStrengthScore - left.camOutcome.seasonStrengthScore ||
      right.camOutcome.weeks1To4Score - left.camOutcome.weeks1To4Score ||
      right.camOutcome.week1Score - left.camOutcome.week1Score ||
      left.label.localeCompare(right.label),
  );
  const bestRun = sorted[0];
  const worstRun = sorted[sorted.length - 1];
  if (!bestRun || !worstRun) throw new Error("Cannot build mock analytics without runs.");

  const week1Scores = runs.map(run => run.camOutcome.week1Score);
  const weeks1To4Scores = runs.map(run => run.camOutcome.weeks1To4Score);
  return {
    minimumWeek1Score: roundToTwo(Math.min(...week1Scores)),
    maximumWeek1Score: roundToTwo(Math.max(...week1Scores)),
    averageWeek1Score: roundToTwo(average(week1Scores)),
    minimumWeeks1To4Score: roundToTwo(Math.min(...weeks1To4Scores)),
    maximumWeeks1To4Score: roundToTwo(Math.max(...weeks1To4Scores)),
    averageWeeks1To4Score: roundToTwo(average(weeks1To4Scores)),
    bestRunLabel: bestRun.label,
    worstRunLabel: worstRun.label,
  };
};
