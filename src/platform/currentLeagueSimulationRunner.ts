import { keepers } from "../../config/keepers.js";
import { loadHistoricalAuctionRecords } from "../data/parseHistoricalBoards.js";
import { runMockBatch, type RunMockBatchOptions } from "../modeling/mockBatch.js";
import { buildPricingConfigFromSources, playerEvidencePathFor } from "../pricingConfig.js";
import { loadCurrentProjections } from "../projections.js";
import type { SimulationMockBatchRunner } from "./simulations.js";
import type { PlatformRuntimeConfig } from "./platformRuntimeConfig.js";

export interface CreateCurrentLeagueSimulationRunnerOptions {
  projectionPath?: string | undefined;
  playerContextPath?: string | undefined;
  playerEvidencePath?: string | undefined;
  useDefaultEvidence?: boolean | undefined;
  diagnosticsMode?: RunMockBatchOptions["diagnosticsMode"] | undefined;
}

const defaultProjectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";

export const createCurrentLeagueSimulationRunner = async ({
  projectionPath = defaultProjectionPath,
  playerContextPath,
  playerEvidencePath,
  useDefaultEvidence = true,
  diagnosticsMode = "summary",
}: CreateCurrentLeagueSimulationRunnerOptions = {}): Promise<SimulationMockBatchRunner> => {
  const resolvedPlayerEvidencePath = playerEvidencePathFor({
    ...(playerEvidencePath === undefined ? {} : { playerEvidencePath }),
    useDefaultEvidence,
  });
  const [pricingConfig, projections, historicalRecords] = await Promise.all([
    buildPricingConfigFromSources({
      ...(playerContextPath === undefined ? {} : { playerContextPath }),
      ...(resolvedPlayerEvidencePath === undefined ? {} : { playerEvidencePath: resolvedPlayerEvidencePath }),
      useDefaultEvidence,
    }),
    loadCurrentProjections({ projectionPath }),
    loadHistoricalAuctionRecords(),
  ]);

  return options =>
    runMockBatch({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: options.runsPerScenario,
      seedPrefix: options.seedPrefix,
      pricingConfig,
      forcedSales: options.forcedSales,
      diagnosticsMode,
    });
};

export const createDisabledSimulationRunner = (): SimulationMockBatchRunner =>
  () => {
    throw new Error("Simulation data runner is disabled. Set MOCKD_SIMULATION_DATA_MODE=local-fixtures for local fixture-backed simulations.");
  };

export const createSimulationRunnerForRuntime = async (
  config: Pick<PlatformRuntimeConfig, "simulationDataMode">,
): Promise<SimulationMockBatchRunner> =>
  config.simulationDataMode === "local-fixtures"
    ? await createCurrentLeagueSimulationRunner()
    : createDisabledSimulationRunner();
