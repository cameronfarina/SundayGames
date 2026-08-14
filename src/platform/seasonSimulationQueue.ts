import {
  SeasonSimulationError,
  type RunSeasonSimulationsInput,
  type SeasonSimulationProgress,
  type SeasonSimulationResult,
} from "./seasonSimulationEngine.js";
import {
  accountCapacityFor,
  SeasonSimulationAccountCapacity,
} from "./seasonSimulationAccountCapacity.js";
import type {
  SeasonSimulationRunner,
  SeasonSimulationRunnerLimits,
} from "./seasonSimulationRunner.js";

interface PendingSimulation {
  input: RunSeasonSimulationsInput;
  signal?: AbortSignal | undefined;
  onProgress?: ((progress: SeasonSimulationProgress) => void) | undefined;
  abortWhilePending?: (() => void) | undefined;
  releaseAccount: () => void;
  resolve: (result: SeasonSimulationResult) => void;
  reject: (error: Error) => void;
}

const defaultTimeoutMs = 120_000;
const positiveWholeNumber = (value: number): boolean => Number.isInteger(value) && value > 0;

export const createBoundedSeasonSimulationRunner = (
  execute: SeasonSimulationRunner,
  limits: SeasonSimulationRunnerLimits = {},
): SeasonSimulationRunner => {
  const maxConcurrent = limits.maxConcurrent ?? 2;
  const maxPending = limits.maxPending ?? 8;
  const timeoutMs = limits.timeoutMs ?? defaultTimeoutMs;
  if (!positiveWholeNumber(maxConcurrent)) throw new Error("Season simulation worker concurrency must be a positive whole number.");
  if (!positiveWholeNumber(maxPending)) throw new Error("Season simulation pending capacity must be a positive whole number.");
  if (!positiveWholeNumber(timeoutMs)) throw new Error("Season simulation timeout must be a positive whole number of milliseconds.");
  const accounts = new SeasonSimulationAccountCapacity(accountCapacityFor(
    limits.maxOutstandingPerAccount,
    maxConcurrent + maxPending,
  ));
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
        if (timedOut) return new SeasonSimulationError(
          "simulation_timeout",
          "Season simulation took too long and was stopped.",
        );
        return next.signal?.aborted === true
          ? new SeasonSimulationError("simulation_canceled", "Season simulation was canceled.")
          : null;
      };
      void execute(next.input, {
        signal: executionAbort.signal,
        onProgress: next.onProgress,
      }).then(result => {
        const interruption = interruptionError();
        if (interruption === null) next.resolve(result);
        else next.reject(interruption);
      }, error => next.reject(interruptionError() ?? (
        error instanceof Error ? error : new Error("Season simulation failed.")
      ))).finally(() => {
        clearTimeout(timeout);
        next.signal?.removeEventListener("abort", forwardAbort);
        activeCount -= 1;
        next.releaseAccount();
        drain();
      });
    }
  };

  return async (input, options = {}) => await new Promise((resolve, reject) => {
    if (options.signal?.aborted === true) {
      reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
      return;
    }
    let releaseAccount: () => void;
    try {
      releaseAccount = accounts.acquire(options.accountId);
    } catch (error) {
      reject(error);
      return;
    }
    if (activeCount >= maxConcurrent && pending.length >= maxPending) {
      releaseAccount();
      reject(new SeasonSimulationError("simulation_busy", "Simulation capacity is full. Try again shortly."));
      return;
    }
    const next: PendingSimulation = {
      input: structuredClone(input),
      signal: options.signal,
      onProgress: options.onProgress,
      releaseAccount,
      resolve,
      reject,
    };
    const abortWhilePending = (): void => {
      const index = pending.indexOf(next);
      if (index === -1) return;
      pending.splice(index, 1);
      next.releaseAccount();
      reject(new SeasonSimulationError("simulation_canceled", "Season simulation was canceled."));
    };
    next.abortWhilePending = abortWhilePending;
    options.signal?.addEventListener("abort", abortWhilePending, { once: true });
    pending.push(next);
    drain();
  });
};
