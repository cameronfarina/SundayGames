import type {
  FantasyProsDatasetRefresh,
  FantasyProsRefreshDependencies,
  FantasyProsRefreshResult,
} from "./contracts.js";
import { fantasyProsDatasetRefreshes } from "./datasets.js";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const refreshDataset = async (
  entry: FantasyProsDatasetRefresh,
  dependencies: FantasyProsRefreshDependencies,
  now: Date,
): Promise<FantasyProsRefreshResult> => {
  const { client, repository } = dependencies;
  const claimed = await repository.claimRefresh({
    dataset: entry.dataset,
    now,
    cadenceMs: entry.cadenceMs,
  });
  if (!claimed) {
    return { dataset: entry.dataset, status: "skipped", requestCount: 0, rowCount: 0 };
  }

  try {
    const rowCount = await entry.run({ client, repository, fetchedAt: now.toISOString() });
    await repository.recordRefreshOutcome({
      dataset: entry.dataset,
      now,
      requestCount: entry.requestCount,
      rowCount,
    });
    return { dataset: entry.dataset, status: "refreshed", requestCount: entry.requestCount, rowCount };
  } catch (error) {
    dependencies.onError?.(entry.dataset, error);
    // The claim already moved the timestamp forward, so a failing dataset waits
    // out its cadence instead of retrying against the shared request budget.
    await repository.recordRefreshOutcome({
      dataset: entry.dataset,
      now,
      requestCount: entry.requestCount,
      error: errorMessage(error),
    });
    return { dataset: entry.dataset, status: "failed", requestCount: entry.requestCount, rowCount: 0 };
  }
};

export const refreshFantasyProsDatasets = async (
  dependencies: FantasyProsRefreshDependencies,
  entries: readonly FantasyProsDatasetRefresh[] = fantasyProsDatasetRefreshes,
): Promise<readonly FantasyProsRefreshResult[]> => {
  const now = (dependencies.now ?? (() => new Date()))();
  const results: FantasyProsRefreshResult[] = [];
  for (const entry of entries) {
    results.push(await refreshDataset(entry, dependencies, now));
  }
  return results;
};
