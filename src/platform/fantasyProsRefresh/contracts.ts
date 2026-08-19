import type { FantasyProsDataset, FantasyProsRepository } from "../fantasyPros.js";

/** Names the failing dataset, or the whole pass when the store itself is down. */
export type FantasyProsRefreshErrorSource = FantasyProsDataset | "refresh-pass";

export interface FantasyProsRefreshDependencies {
  repository: FantasyProsRepository;
  now?: (() => Date) | undefined;
  onError?: ((source: FantasyProsRefreshErrorSource, error: unknown) => void) | undefined;
}

export type FantasyProsRefreshStatus = "refreshed" | "partial" | "skipped" | "failed";

export interface FantasyProsDatasetRunResult {
  rowCount: number;
  /** One entry per request that failed; empty means the dataset fully refreshed. */
  failures: readonly string[];
}

export interface FantasyProsRefreshResult {
  dataset: FantasyProsDataset;
  status: FantasyProsRefreshStatus;
  requestCount: number;
  rowCount: number;
}

/**
 * A scheduled dataset. Each entry closes over whatever it needs to run, so a
 * dataset that needs no FantasyPros key can be scheduled without one.
 */
export interface FantasyProsDatasetRefresh {
  dataset: FantasyProsDataset;
  cadenceMs: number;
  /** FantasyPros requests one run costs, counted against the daily quota. */
  requestCount: number;
  run(fetchedAt: string): Promise<FantasyProsDatasetRunResult>;
}

export interface FantasyProsRefreshLoop {
  stop(): void;
}
