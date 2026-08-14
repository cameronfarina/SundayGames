import type { MockResultsRun } from "../mockResults.js";
import type { StrategyLabSampleBuild } from "./reportContracts.js";
import {
  benchWeek1ScoreFor,
  dollarPlayerCountFor,
  primaryTeamFor,
  starterFloorWeek1ScoreFor,
  thinnessScoreFor,
} from "./runMetrics.js";

export const sampleBuildFor = (run: MockResultsRun): StrategyLabSampleBuild => ({
  label: run.label,
  seed: run.seed,
  camRank: run.camOutcome.rank,
  camWeek1Score: run.camOutcome.week1Score,
  camSeasonStrengthScore: run.camOutcome.seasonStrengthScore,
  camSpend: run.camOutcome.spend,
  camBudgetRemaining: run.camOutcome.budgetRemaining,
  camBenchWeek1Score: benchWeek1ScoreFor(run),
  camStarterFloorWeek1Score: starterFloorWeek1ScoreFor(run),
  camDollarPlayers: dollarPlayerCountFor(run),
  thinnessScore: thinnessScoreFor(run),
  corePlayers: run.camOutcome.corePlayers,
  camPlayers: primaryTeamFor(run).players,
});
