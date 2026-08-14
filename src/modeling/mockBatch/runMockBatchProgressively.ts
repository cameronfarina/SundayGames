import { defaultPricingConfig } from "../basePricing.js";
import { buildMockBatch } from "./batchResult.js";
import { defaultRunsPerScenario, defaultScenarioKeys, defaultSeedPrefix } from "./constants.js";
import type {
  MockBatch,
  MockRun,
  RunMockBatchProgressiveOptions,
  RunMockBatchRunContext,
} from "./contracts.js";
import { prepareMockInputs } from "./preparation.js";
import { runPreparedScenario } from "./runPreparedScenario.js";

export const runMockBatchProgressively = async ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  auctionConfigOverridesForRun,
  forcedSalesForRun,
  diagnosticsMode = "full",
  onRunComplete,
}: RunMockBatchProgressiveOptions): Promise<MockBatch> => {
  const normalizedScenarioKeys = [...scenarioKeys];
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: normalizedScenarioKeys,
    pricingConfig,
  });
  const totalRuns = preparation.scenarios.length * runsPerScenario;
  const runs: MockRun[] = [];

  for (const preparedScenario of preparation.scenarios) {
    for (let index = 0; index < runsPerScenario; index += 1) {
      const seed = `${seedPrefix}:${preparedScenario.scenario.key}:${index + 1}`;
      const runContext: RunMockBatchRunContext = {
        scenarioKey: preparedScenario.scenario.key,
        runIndex: index + 1,
        completedRuns: runs.length,
        seed,
      };
      const run = runPreparedScenario({
        preparedScenario,
        ownerDemandMultipliers: preparation.ownerDemandMultipliers,
        ownerBehaviors: preparation.ownerBehaviors,
        ownerRosterMaximums: preparation.ownerRosterMaximums,
        seed,
        auctionConfigOverrides: auctionConfigOverridesForRun?.(runContext)
          ?? auctionConfigOverrides,
        forcedSales: forcedSalesForRun?.(runContext) ?? forcedSales,
        diagnosticsMode,
      });
      runs.push(run);
      await onRunComplete?.({ run, completedRuns: runs.length, totalRuns });
    }
  }

  return buildMockBatch({
    scenarioKeys: normalizedScenarioKeys,
    runsPerScenario,
    seedPrefix,
    diagnosticsMode,
    forcedSales,
    runs,
  });
};
