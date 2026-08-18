import type {
  FantasyProsRefreshDependencies,
  FantasyProsRefreshLoop,
} from "./contracts.js";
import { refreshFantasyProsDatasets } from "./refresh.js";

// Each pass only fetches datasets whose stored timestamp is past its cadence,
// so polling more often than the cadence costs nothing.
export const fantasyProsRefreshPollIntervalMs = 15 * 60 * 1000;

export interface StartFantasyProsRefreshLoopOptions extends FantasyProsRefreshDependencies {
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
    void refreshFantasyProsDatasets(options)
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
