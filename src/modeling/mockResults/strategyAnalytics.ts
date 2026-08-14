import type { LiveDraftStrategyKey } from "../liveDraftStrategies.js";
import type { MockResultsStrategyAnalytics } from "./analyticsContracts.js";
import { average, roundToTwo } from "./formatting.js";
import type { MockResultsRun } from "./reportContracts.js";

export const strategyLeaderboardFor = (
  runs: readonly MockResultsRun[],
): MockResultsStrategyAnalytics[] => {
  const runsByStrategy = new Map<LiveDraftStrategyKey, MockResultsRun[]>();
  for (const run of runs) {
    runsByStrategy.set(run.strategyKey, [...(runsByStrategy.get(run.strategyKey) ?? []), run]);
  }

  return [...runsByStrategy.entries()]
    .map(([strategyKey, strategyRuns]) => {
      const outcomes = strategyRuns.map(run => run.camOutcome);
      const ranks = outcomes.map(outcome => outcome.rank);
      return {
        strategyKey,
        runCount: strategyRuns.length,
        averageCamRank: roundToTwo(average(ranks)),
        bestCamRank: Math.min(...ranks),
        worstCamRank: Math.max(...ranks),
        averageCamWeek1Score: roundToTwo(average(outcomes.map(outcome => outcome.week1Score))),
        averageCamWeeks1To4Score: roundToTwo(average(outcomes.map(outcome => outcome.weeks1To4Score))),
        averageCamSeasonStrengthScore: roundToTwo(
          average(outcomes.map(outcome => outcome.seasonStrengthScore)),
        ),
        averageCamSpend: roundToTwo(average(outcomes.map(outcome => outcome.spend))),
      };
    })
    .sort(
      (left, right) =>
        left.averageCamRank - right.averageCamRank ||
        right.averageCamSeasonStrengthScore - left.averageCamSeasonStrengthScore ||
        right.averageCamWeeks1To4Score - left.averageCamWeeks1To4Score ||
        left.strategyKey.localeCompare(right.strategyKey),
    );
};
