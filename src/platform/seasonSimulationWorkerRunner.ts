import { Worker } from "node:worker_threads";

import {
  SeasonSimulationError,
  type RunSeasonSimulationsInput,
  type SeasonSimulationErrorCode,
  type SeasonSimulationProgress,
  type SeasonSimulationResult,
} from "./seasonSimulationEngine.js";
import { createBoundedSeasonSimulationRunner } from "./seasonSimulationQueue.js";
import type {
  SeasonSimulationRunner,
  SeasonSimulationRunnerLimits,
  SeasonSimulationRunOptions,
} from "./seasonSimulationRunner.js";

export { createBoundedSeasonSimulationRunner } from "./seasonSimulationQueue.js";
export type {
  SeasonSimulationRunner,
  SeasonSimulationRunnerLimits,
  SeasonSimulationRunOptions,
} from "./seasonSimulationRunner.js";

interface WorkerSuccess {
  ok: true;
  result: SeasonSimulationResult;
}

interface WorkerFailure {
  ok: false;
  error: {
    name: string;
    message: string;
    code?: SeasonSimulationErrorCode | undefined;
  };
}

type WorkerMessage = WorkerSuccess | WorkerFailure;

interface WorkerProgress {
  type: "progress";
  progress: SeasonSimulationProgress;
}

type SeasonSimulationWorkerMessage = WorkerMessage | WorkerProgress;

const defaultSeasonSimulationTimeoutMs = 120_000;

const workerModuleUrl = (): URL => import.meta.url.endsWith(".ts")
  ? new URL("./seasonSimulationWorkerThread.ts", import.meta.url)
  : new URL("./seasonSimulationWorkerThread.js", import.meta.url);

const developmentWorkerSource = `
const { workerData } = require("node:worker_threads");
void import("tsx/esm/api")
  .then(({ tsImport }) => tsImport(workerData.moduleUrl, workerData.parentUrl))
  .catch(error => setImmediate(() => { throw error; }));
`;

const errorForWorkerFailure = (failure: WorkerFailure["error"]): Error => {
  if (failure.name === SeasonSimulationError.name && failure.code !== undefined) {
    return new SeasonSimulationError(failure.code, failure.message);
  }

  const error = new Error(failure.message);
  error.name = failure.name;
  return error;
};

const runInWorker = async (
  input: RunSeasonSimulationsInput,
  options: SeasonSimulationRunOptions = {},
): Promise<SeasonSimulationResult> => await new Promise((resolve, reject) => {
  if (options.signal?.aborted === true) {
    reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
    return;
  }
  const sourceMode = import.meta.url.endsWith(".ts");
  const worker = sourceMode
    ? new Worker(developmentWorkerSource, {
        eval: true,
        workerData: {
          input,
          moduleUrl: workerModuleUrl().href,
          parentUrl: import.meta.url,
        },
      })
    : new Worker(workerModuleUrl(), { workerData: { input } });
  let settled = false;

  const finish = (complete: () => void): void => {
    if (settled) return;
    settled = true;
    options.signal?.removeEventListener("abort", abort);
    complete();
  };
  const abort = (): void => {
    finish(() => {
      void worker.terminate();
      reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
    });
  };
  options.signal?.addEventListener("abort", abort, { once: true });

  worker.on("message", (message: SeasonSimulationWorkerMessage) => {
    if (settled) return;
    if ("type" in message) {
      options.onProgress?.(message.progress);
      return;
    }
    finish(() => {
      if (message.ok) resolve(message.result);
      else reject(errorForWorkerFailure(message.error));
    });
  });
  worker.once("error", error => {
    finish(() => reject(error));
  });
  worker.once("exit", code => {
    finish(() => reject(new SeasonSimulationError(
        "simulation_failed",
        `Season simulation worker stopped before returning a result (exit code ${code}).`,
      )));
  });
});

export const createNodeSeasonSimulationRunner = ({
  maxConcurrent = 2,
  maxOutstandingPerAccount,
  maxPending = 8,
  timeoutMs = defaultSeasonSimulationTimeoutMs,
}: SeasonSimulationRunnerLimits = {}): SeasonSimulationRunner => {
  return createBoundedSeasonSimulationRunner(runInWorker, {
    maxConcurrent,
    maxOutstandingPerAccount,
    maxPending,
    timeoutMs,
  });
};
