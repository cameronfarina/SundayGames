import { Worker } from "node:worker_threads";

import {
  SeasonSimulationError,
  type RunSeasonSimulationsInput,
  type SeasonSimulationErrorCode,
  type SeasonSimulationResult,
} from "./seasonSimulationEngine.js";

export interface SeasonSimulationRunOptions {
  signal?: AbortSignal | undefined;
}

export type SeasonSimulationRunner = (
  input: RunSeasonSimulationsInput,
  options?: SeasonSimulationRunOptions,
) => Promise<SeasonSimulationResult>;

export interface CreateNodeSeasonSimulationRunnerOptions {
  maxConcurrent?: number | undefined;
  maxPending?: number | undefined;
  timeoutMs?: number | undefined;
}

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

interface PendingSimulation {
  input: RunSeasonSimulationsInput;
  signal?: AbortSignal | undefined;
  abortWhilePending?: (() => void) | undefined;
  resolve: (result: SeasonSimulationResult) => void;
  reject: (error: Error) => void;
}

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

  worker.once("message", (message: WorkerMessage) => {
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

const positiveWholeNumber = (value: number): boolean => Number.isInteger(value) && value > 0;

export const createBoundedSeasonSimulationRunner = (
  execute: SeasonSimulationRunner,
  {
    maxConcurrent = 2,
    maxPending = 8,
    timeoutMs = 30_000,
  }: CreateNodeSeasonSimulationRunnerOptions = {},
): SeasonSimulationRunner => {
  if (!positiveWholeNumber(maxConcurrent)) {
    throw new Error("Season simulation worker concurrency must be a positive whole number.");
  }
  if (!positiveWholeNumber(maxPending)) {
    throw new Error("Season simulation pending capacity must be a positive whole number.");
  }
  if (!positiveWholeNumber(timeoutMs)) {
    throw new Error("Season simulation timeout must be a positive whole number of milliseconds.");
  }

  let activeCount = 0;
  const pending: PendingSimulation[] = [];

  const drain = (): void => {
    while (activeCount < maxConcurrent && pending.length > 0) {
      const next = pending.shift();
      if (next === undefined) return;
      if (next.abortWhilePending !== undefined) {
        next.signal?.removeEventListener("abort", next.abortWhilePending);
      }
      activeCount += 1;
      const executionAbort = new AbortController();
      let timedOut = false;
      const forwardAbort = (): void => executionAbort.abort();
      next.signal?.addEventListener("abort", forwardAbort, { once: true });
      const timeout = setTimeout(() => {
        timedOut = true;
        executionAbort.abort();
      }, timeoutMs);

      const interruptionError = (): SeasonSimulationError | null => {
        if (timedOut) {
          return new SeasonSimulationError(
            "simulation_timeout",
            "Season simulation took too long and was stopped.",
          );
        }
        return next.signal?.aborted === true
          ? new SeasonSimulationError("simulation_canceled", "Season simulation was canceled.")
          : null;
      };

      void execute(next.input, { signal: executionAbort.signal }).then(result => {
        const interruption = interruptionError();
        if (interruption === null) next.resolve(result);
        else next.reject(interruption);
      }, error => {
        next.reject(interruptionError() ?? (
          error instanceof Error ? error : new Error("Season simulation failed.")
        ));
      }).finally(() => {
        clearTimeout(timeout);
        next.signal?.removeEventListener("abort", forwardAbort);
        activeCount -= 1;
        drain();
      });
    }
  };

  return async (input, options = {}) => await new Promise<SeasonSimulationResult>((resolve, reject) => {
    if (options.signal?.aborted === true) {
      reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
      return;
    }
    if (activeCount >= maxConcurrent && pending.length >= maxPending) {
      reject(new SeasonSimulationError(
        "simulation_busy",
        "Simulation capacity is full. Try again shortly.",
      ));
      return;
    }

    const next: PendingSimulation = {
      input: structuredClone(input),
      signal: options.signal,
      resolve,
      reject,
    };
    const abortWhilePending = (): void => {
      const index = pending.indexOf(next);
      if (index === -1) return;
      pending.splice(index, 1);
      reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
    };
    next.abortWhilePending = abortWhilePending;
    options.signal?.addEventListener("abort", abortWhilePending, { once: true });
    pending.push(next);
    drain();
  });
};

export const createNodeSeasonSimulationRunner = ({
  maxConcurrent = 2,
  maxPending = 8,
  timeoutMs = 30_000,
}: CreateNodeSeasonSimulationRunnerOptions = {}): SeasonSimulationRunner => {
  return createBoundedSeasonSimulationRunner(runInWorker, {
    maxConcurrent,
    maxPending,
    timeoutMs,
  });
};
