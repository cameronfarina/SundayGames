import type {
  FantasyProsDatasetRefresh,
  FantasyProsRefreshDependencies,
  FantasyProsRefreshLoop,
} from "./contracts.js";
import { refreshFantasyProsDatasets } from "./refresh.js";

// Each pass only fetches datasets whose stored timestamp is past its cadence, so
// polling more often than the cadence costs nothing. It has to be shorter than
// the shortest cadence, or jitter makes a dataset miss its window and land at
// twice its intended interval.
export const fantasyProsRefreshPollIntervalMs = 5 * 60 * 1000;

export interface StartFantasyProsRefreshLoopOptions extends FantasyProsRefreshDependencies {
  entries: readonly FantasyProsDatasetRefresh[];
  pollIntervalMs?: number | undefined;
}

export const startFantasyProsRefreshLoop = (
  options: StartFantasyProsRefreshLoopOptions,
): FantasyProsRefreshLoop => {
  let running = false;
  let stopped = false;

  const pass = (): void => {
    if (running || stopped) return;
    running = true;
    void refreshFantasyProsDatasets(options, options.entries)
      .catch(error => options.onError?.("refresh-pass", error))
      .finally(() => {
        running = false;
      });
  };

  const timer = setInterval(pass, options.pollIntervalMs ?? fantasyProsRefreshPollIntervalMs);
  // A refresh must never keep the process alive through a shutdown.
  timer.unref();
  pass();

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
};
