import { parentPort, workerData } from "node:worker_threads";

import { runSeasonSimulationWorker } from "./seasonSimulationWorkerThread/run.js";

if (parentPort === null) {
  throw new Error("The season simulation worker requires a parent thread.");
}
const workerParentPort = parentPort;

runSeasonSimulationWorker(workerData, message => workerParentPort.postMessage(message));
