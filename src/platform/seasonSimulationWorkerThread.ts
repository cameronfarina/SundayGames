import { parentPort, workerData } from "node:worker_threads";

import {
  runSeasonSimulations,
  SeasonSimulationError,
  type RunSeasonSimulationsInput,
} from "./seasonSimulationEngine.js";

interface SeasonSimulationWorkerData {
  input: RunSeasonSimulationsInput;
}

if (parentPort === null) {
  throw new Error("The season simulation worker requires a parent thread.");
}
const workerParentPort = parentPort;

try {
  workerParentPort.postMessage({
    ok: true,
    result: runSeasonSimulations((workerData as SeasonSimulationWorkerData).input, {
      onProgress: progress => workerParentPort.postMessage({ type: "progress", progress }),
    }),
  });
} catch (error) {
  workerParentPort.postMessage({
    ok: false,
    error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : "Season simulation failed.",
      ...(error instanceof SeasonSimulationError ? { code: error.code } : {}),
    },
  });
}
