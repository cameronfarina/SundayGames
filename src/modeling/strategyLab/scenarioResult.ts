import type { MockResultsRun } from "../mockResults.js";
import { sampleBuildLimit } from "./defaultScenarios.js";
import { average, roundToTwo } from "./math.js";
import type {
  StrategyLabScenarioResult,
} from "./reportContracts.js";
import {
  benchWeek1ScoreFor,
  dollarPlayerCountFor,
  starterFloorWeek1ScoreFor,
  thinnessScoreFor,
} from "./runMetrics.js";
import { sampleBuildFor } from "./sampleBuild.js";
import type {
  StrategyLabForcedStart,
  StrategyLabScenario,
} from "./scenarioContracts.js";
import { targetOutcomesFor } from "./targetOutcomes.js";

export const scenarioResultFor = (
  scenario: StrategyLabScenario,
  mockRuns: readonly MockResultsRun[],
  camForcedStart: StrategyLabForcedStart,
): StrategyLabScenarioResult => {
  const camRanks = mockRuns.map(run => run.camOutcome.rank);
  const samples = mockRuns
    .map(sampleBuildFor)
    .sort(
      (left, right) =>
        left.camRank - right.camRank
        || right.camSeasonStrengthScore - left.camSeasonStrengthScore
        || left.thinnessScore - right.thinnessScore
        || left.seed.localeCompare(right.seed),
    );

  return {
    key: scenario.key,
    label: scenario.label,
    question: scenario.question,
    strategyKey: scenario.strategyKey,
    forcedSales: [...scenario.forcedSales],
    targetMaxBids: [...(scenario.targetMaxBids ?? [])],
    targetOutcomes: targetOutcomesFor(scenario.targetMaxBids ?? [], mockRuns),
    ...(scenario.notes === undefined ? {} : { notes: scenario.notes }),
    camForcedStart,
    runCount: mockRuns.length,
    averageCamRank: roundToTwo(average(camRanks)),
    bestCamRank: Math.min(...camRanks),
    worstCamRank: Math.max(...camRanks),
    averageCamWeek1Score: roundToTwo(average(mockRuns.map(run => run.camOutcome.week1Score))),
    averageCamSeasonStrengthScore: roundToTwo(
      average(mockRuns.map(run => run.camOutcome.seasonStrengthScore)),
    ),
    averageCamSpend: roundToTwo(average(mockRuns.map(run => run.camOutcome.spend))),
    averageCamBudgetRemaining: roundToTwo(
      average(mockRuns.map(run => run.camOutcome.budgetRemaining)),
    ),
    averageCamBenchWeek1Score: roundToTwo(average(mockRuns.map(benchWeek1ScoreFor))),
    averageCamStarterFloorWeek1Score: roundToTwo(
      average(mockRuns.map(starterFloorWeek1ScoreFor)),
    ),
    averageCamDollarPlayers: roundToTwo(average(mockRuns.map(dollarPlayerCountFor))),
    averageThinnessScore: roundToTwo(average(mockRuns.map(thinnessScoreFor))),
    sampleBuilds: samples.slice(0, sampleBuildLimit),
  };
};
