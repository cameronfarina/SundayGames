import { buildBasePrices, defaultPricingConfig } from "../basePricing.js";
import { applyKeeperScenarioToPrices, buildKeeperScenarios } from "../keeperInflation.js";
import { runMockBatch } from "../mockBatch.js";
import {
  defaultLimit,
  defaultRuns,
  defaultScenarioKey,
  defaultSeedPrefix,
} from "./constants.js";
import type {
  BuildTopPlayerSanityReportOptions,
  TopPlayerSanityReport,
} from "./contracts.js";
import { highPriceVolumeFor } from "./highPriceVolume.js";
import { rowsFor } from "./rows.js";
import { flagCountsFor } from "./summary.js";

export const buildTopPlayerSanityReport = ({
  projections,
  historicalRecords,
  keepers,
  scenarioKey = defaultScenarioKey,
  limit = defaultLimit,
  runs = defaultRuns,
  seedPrefix = defaultSeedPrefix,
  pricingConfig = defaultPricingConfig,
  mockBatch,
}: BuildTopPlayerSanityReportOptions): TopPlayerSanityReport => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const scenario = buildKeeperScenarios(keepers).find(candidate => candidate.key === scenarioKey);
  if (scenario === undefined) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);
  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const batch = mockBatch ?? runMockBatch({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: runs,
    seedPrefix,
    pricingConfig,
  });
  const scenarioRuns = batch.runs.filter(run => run.keeperScenario.key === scenarioKey);
  if (scenarioRuns.length === 0) throw new Error(`No mock runs found for scenario "${scenarioKey}".`);
  const players = rowsFor(appliedScenario.availablePrices, scenarioRuns, limit);
  const flaggedPlayers = players.filter(player => player.flags.length > 0);
  return {
    config: { scenarioKey, limit, runs: scenarioRuns.length, seedPrefix },
    scenario: {
      label: scenario.label,
      openAuctionDollars: scenario.openAuctionDollars,
      globalFactor: scenario.globalFactor,
    },
    summary: {
      reviewedCount: players.length,
      flaggedPlayerCount: flaggedPlayers.length,
      flagCounts: flagCountsFor(players),
      highPriceVolume: highPriceVolumeFor(
        historicalRecords,
        appliedScenario.availablePrices,
        scenarioRuns,
      ),
    },
    players,
    flaggedPlayers,
  };
};
