import type {
  RunSeasonSimulationsInput,
  SeasonSimulationProgress,
  SeasonSimulationResult,
} from "./seasonSimulationEngine.js";

export interface SeasonSimulationRunOptions {
  accountId?: string | undefined;
  signal?: AbortSignal | undefined;
  onProgress?: ((progress: SeasonSimulationProgress) => void) | undefined;
}

export type SeasonSimulationRunner = (
  input: RunSeasonSimulationsInput,
  options?: SeasonSimulationRunOptions,
) => Promise<SeasonSimulationResult>;

export interface SeasonSimulationRunnerLimits {
  maxConcurrent?: number | undefined;
  maxOutstandingPerAccount?: number | undefined;
  maxPending?: number | undefined;
  timeoutMs?: number | undefined;
}
