import { runSeasonSimulations } from
  "../../../../../src/platform/seasonSimulationEngine/orchestrator";
import { seasonSimulationInputValue } from
  "../../../../../src/platform/platformStoreSnapshotCodec/decoding/seasonSimulationInput";
import type {
  SeasonSimulationProgress,
  SeasonSimulationResult,
} from "../../../../../src/platform/seasonSimulationEngine/contracts";

export const executeBrowserSimulation = (
  input: unknown,
  onProgress: (progress: SeasonSimulationProgress) => void,
): SeasonSimulationResult => runSeasonSimulations(
  seasonSimulationInputValue(input, "browserSimulation.input"),
  { onProgress },
);
