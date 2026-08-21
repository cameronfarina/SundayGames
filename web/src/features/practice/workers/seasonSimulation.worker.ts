import type { SeasonSimulationProgress } from
  "../../../../../src/platform/seasonSimulationEngine/contracts";
import { executeBrowserSimulation } from "../api/browserSimulationExecution";

const inputFrom = (value: unknown): unknown => {
  if (value === null || typeof value !== "object" || !("input" in value)) {
    throw new Error("Browser simulation input is missing.");
  }
  return value.input;
};

export const simulationWorkerErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : "Simulation failed.";

export const handleSeasonSimulationWorkerMessage = (
  value: unknown,
  postMessage: (message: unknown) => void,
): void => {
  try {
    const onProgress = (progress: SeasonSimulationProgress): void => {
      postMessage({ type: "progress", progress });
    };
    postMessage({
      type: "result",
      result: executeBrowserSimulation(inputFrom(value), onProgress),
    });
  } catch (error) {
    postMessage({
      type: "error",
      message: simulationWorkerErrorMessage(error),
    });
  }
};

globalThis.onmessage = event => {
  handleSeasonSimulationWorkerMessage(event.data, message => globalThis.postMessage(message));
};
