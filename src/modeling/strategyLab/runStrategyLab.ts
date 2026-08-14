import { primaryOwner } from "../../../config/league.js";
import { strategyAuctionOverridesFor } from "../interactiveMockDraft.js";
import { runMockBatchProgressively } from "../mockBatch.js";
import { buildMockResultsReport } from "../mockResults.js";
import { targetMaxBidOverridesFor } from "./auctionOverrides.js";
import {
  defaultRunsPerScenario,
  defaultScenarioKey,
  defaultSeedPrefix,
  defaultStrategyLabScenarios,
} from "./defaultScenarios.js";
import { forcedStartFor } from "./forcedStart.js";
import { leaderboardFor } from "./leaderboard.js";
import type {
  RunStrategyLabOptions,
  StrategyLabReport,
  StrategyLabScenarioResult,
} from "./reportContracts.js";
import { scenarioResultFor } from "./scenarioResult.js";

export const runStrategyLab = async ({
  projections,
  historicalRecords,
  keepers,
  scenarios = defaultStrategyLabScenarios,
  scenarioKey = defaultScenarioKey,
  runsPerScenario = defaultRunsPerScenario,
  seedPrefix = defaultSeedPrefix,
  pricingConfig,
}: RunStrategyLabOptions): Promise<StrategyLabReport> => {
  const scenarioResults: StrategyLabScenarioResult[] = [];

  for (const strategyScenario of scenarios) {
    const batch = await runMockBatchProgressively({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: [scenarioKey],
      runsPerScenario,
      seedPrefix: `${seedPrefix}:${strategyScenario.key}`,
      ...(pricingConfig === undefined ? {} : { pricingConfig }),
      diagnosticsMode: "summary",
      forcedSales: strategyScenario.forcedSales,
      auctionConfigOverridesForRun: context => ({
        ...strategyAuctionOverridesFor(
          primaryOwner,
          strategyScenario.strategyKey,
          { variantSeed: context.seed },
        ),
        ...targetMaxBidOverridesFor(strategyScenario.targetMaxBids ?? []),
      }),
    });
    const mockResults = buildMockResultsReport(
      batch,
      strategyScenario.strategyKey,
      batch.runs.map(() => strategyScenario.strategyKey),
    );
    const camForcedStart = forcedStartFor({
      keepers,
      projections,
      scenarioKey,
      forcedSales: strategyScenario.forcedSales,
    });
    scenarioResults.push(scenarioResultFor(strategyScenario, mockResults.runs, camForcedStart));
  }

  return {
    mode: "strategy-lab",
    options: { scenarioKey, runsPerScenario, seedPrefix },
    leaderboard: leaderboardFor(scenarioResults),
    scenarios: scenarioResults,
  };
};
