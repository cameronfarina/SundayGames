import { defaultPricingConfig } from "../basePricing.js";
import { buildMockBatch } from "./batchResult.js";
import { defaultRunsPerScenario, defaultScenarioKeys, defaultSeedPrefix } from "./constants.js";
import type { MockBatch, RunMockBatchOptions } from "./contracts.js";
import { prepareMockInputs } from "./preparation.js";
import { runPreparedScenario } from "./runPreparedScenario.js";

export const runMockBatch = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKeys = defaultScenarioKeys,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  diagnosticsMode = "full",
}: RunMockBatchOptions): MockBatch => {
  const normalizedScenarioKeys = [...scenarioKeys];
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: normalizedScenarioKeys,
    pricingConfig,
  });
  const runs = preparation.scenarios.flatMap(preparedScenario =>
    Array.from({ length: runsPerScenario }, (_, index) => runPreparedScenario({
      preparedScenario,
      ownerDemandMultipliers: preparation.ownerDemandMultipliers,
      ownerBehaviors: preparation.ownerBehaviors,
      ownerRosterMaximums: preparation.ownerRosterMaximums,
      seed: `${seedPrefix}:${preparedScenario.scenario.key}:${index + 1}`,
      auctionConfigOverrides,
      forcedSales,
      diagnosticsMode,
    })),
  );

  return buildMockBatch({
    scenarioKeys: normalizedScenarioKeys,
    runsPerScenario,
    seedPrefix,
    diagnosticsMode,
    forcedSales,
    runs,
  });
};
