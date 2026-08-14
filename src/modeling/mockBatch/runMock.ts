import { defaultPricingConfig } from "../basePricing.js";
import type { MockRun, RunMockOptions } from "./contracts.js";
import { prepareMockInputs } from "./preparation.js";
import { runPreparedScenario } from "./runPreparedScenario.js";

export const runMock = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey = "expected",
  seed = "mockd-default",
  pricingConfig = defaultPricingConfig,
  auctionConfigOverrides = {},
  forcedSales = [],
  diagnosticsMode = "full",
}: RunMockOptions): MockRun => {
  const preparation = prepareMockInputs({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    pricingConfig,
  });
  const preparedScenario = preparation.scenarios[0];
  if (!preparedScenario) throw new Error(`Unable to prepare scenario "${scenarioKey}".`);

  return runPreparedScenario({
    preparedScenario,
    ownerDemandMultipliers: preparation.ownerDemandMultipliers,
    ownerBehaviors: preparation.ownerBehaviors,
    ownerRosterMaximums: preparation.ownerRosterMaximums,
    seed,
    auctionConfigOverrides,
    forcedSales,
    diagnosticsMode,
  });
};
