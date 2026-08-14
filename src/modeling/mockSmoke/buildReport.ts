import type { BuildMockSmokeReportOptions, MockSmokeReport } from "./contracts.js";
import { firstSmokeRoundsFor, smokeOwnerCount } from "./picks.js";
import { summarizeSmokeBatch, summarizeSmokePicks } from "./summaries.js";
import { smokeWarningsFor } from "./warnings.js";

const defaultSmokeRounds = 2;

export const buildMockSmokeReport = ({
  run,
  batch,
  rounds = defaultSmokeRounds,
}: BuildMockSmokeReportOptions): MockSmokeReport => {
  const firstTwoRounds = firstSmokeRoundsFor(run, rounds);
  const batchSummary = summarizeSmokeBatch(batch);
  const expectedPickCount = smokeOwnerCount * rounds;

  return {
    seed: run.seed,
    scenarioKey: run.keeperScenario.key,
    roundCount: rounds,
    pickCount: run.pickCount,
    invalidRosterCount: run.invalidRosterCount,
    firstTwoRounds,
    budgetTrajectory: run.budgetTrajectory.filter(row => row.pick <= firstTwoRounds.length),
    firstTwoRoundSummary: summarizeSmokePicks(firstTwoRounds),
    batch: batchSummary,
    warnings: smokeWarningsFor(run, batchSummary, firstTwoRounds, expectedPickCount),
  };
};
