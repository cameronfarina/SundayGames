import type { FantasyProsClient } from "../../data/fantasyPros.js";
import type { FantasyProsDataset, FantasyProsRepository } from "../fantasyPros.js";

/** Names the failing dataset, or the whole pass when the store itself is down. */
export type FantasyProsRefreshErrorSource = FantasyProsDataset | "refresh-pass";

export interface FantasyProsRefreshDependencies {
  client: FantasyProsClient;
  repository: FantasyProsRepository;
  now?: (() => Date) | undefined;
  onError?: ((source: FantasyProsRefreshErrorSource, error: unknown) => void) | undefined;
}

export type FantasyProsRefreshStatus = "refreshed" | "skipped" | "failed";

export interface FantasyProsRefreshResult {
  dataset: FantasyProsDataset;
  status: FantasyProsRefreshStatus;
  requestCount: number;
  rowCount: number;
}

export interface FantasyProsDatasetRefresh {
  dataset: FantasyProsDataset;
  cadenceMs: number;
  requestCount: number;
  run(dependencies: {
    client: FantasyProsClient;
    repository: FantasyProsRepository;
    fetchedAt: string;
  }): Promise<number>;
}

export interface FantasyProsRefreshLoop {
  stop(): void;
}
