import type { SeasonSimulationRunner } from "../seasonSimulationWorkerRunner.js";

interface DeferredSignal {
  promise: Promise<void>;
  resolve(): void;
}

const createDeferredSignal = (): DeferredSignal => {
  let resolveSignal: (() => void) | undefined;
  const promise = new Promise<void>(resolve => {
    resolveSignal = resolve;
  });
  return {
    promise,
    resolve: () => {
      if (resolveSignal === undefined) throw new Error("Deferred signal was not initialized.");
      resolveSignal();
    },
  };
};

export interface SeasonSimulationCapture {
  runner: SeasonSimulationRunner;
  prepare<T>(operation: () => Promise<T>): Promise<{ response: Promise<T> }>;
}

export const createSeasonSimulationCapture = (
  baseRunner: SeasonSimulationRunner,
): SeasonSimulationCapture => {
  let activeCapture: (() => void) | undefined;
  return {
    runner: (input, options) => {
      activeCapture?.();
      return baseRunner(input, options);
    },
    prepare: async operation => {
      const captured = createDeferredSignal();
      activeCapture = captured.resolve;
      const response = operation();
      try {
        await Promise.race([captured.promise, response.then(() => undefined)]);
      } finally {
        activeCapture = undefined;
      }
      return { response };
    },
  };
};
