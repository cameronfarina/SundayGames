import type {
  StrategyLabLeaderboardEntry,
  StrategyLabScenarioResult,
} from "./reportContracts.js";

export const leaderboardFor = (
  scenarios: readonly StrategyLabScenarioResult[],
): StrategyLabLeaderboardEntry[] =>
  scenarios
    .map(scenario => ({
      key: scenario.key,
      label: scenario.label,
      averageCamRank: scenario.averageCamRank,
      bestCamRank: scenario.bestCamRank,
      worstCamRank: scenario.worstCamRank,
      averageCamWeek1Score: scenario.averageCamWeek1Score,
      averageCamSeasonStrengthScore: scenario.averageCamSeasonStrengthScore,
      averageThinnessScore: scenario.averageThinnessScore,
    }))
    .sort(
      (left, right) =>
        left.averageCamRank - right.averageCamRank
        || right.averageCamSeasonStrengthScore - left.averageCamSeasonStrengthScore
        || left.averageThinnessScore - right.averageThinnessScore
        || left.label.localeCompare(right.label),
    );
