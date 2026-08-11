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

try {
  parentPort.postMessage({
    ok: true,
    result: runSeasonSimulations((workerData as SeasonSimulationWorkerData).input),
  });
} catch (error) {
  parentPort.postMessage({
    ok: false,
    error: {
      name: error instanceof Error ? error.name : "Error",
      message: error instanceof Error ? error.message : "Season simulation failed.",
      ...(error instanceof SeasonSimulationError ? { code: error.code } : {}),
    },
  });
}
