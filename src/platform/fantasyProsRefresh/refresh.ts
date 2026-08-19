import { isFantasyProsThrottled } from "../../data/fantasyPros.js";
import type {
  FantasyProsDatasetRefresh,
  FantasyProsRefreshDependencies,
  FantasyProsRefreshResult,
  FantasyProsRefreshStatus,
} from "./contracts.js";

/**
 * A failed dataset used to sit out its whole cadence, so one transient
 * response cost six hours of staleness. Retry sooner than that, but not so
 * soon that an outage burns the daily request budget. A rate refusal is the
 * one failure this delay does not apply to; see fantasyProsThrottleNotice.
 */
export const fantasyProsRetryDelayMs = 30 * 60 * 1000;

/**
 * Prefixed onto the stored error so /fantasypros-status reads honestly: the
 * dataset is not broken, it is waiting, and it is waiting on purpose.
 */
export const fantasyProsThrottleNotice =
  "FantasyPros refused this refresh on rate (HTTP 429), so it waits for its next scheduled run rather than retrying sooner.";

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const statusFor = (rowCount: number, failures: readonly string[]): FantasyProsRefreshStatus => {
  if (failures.length === 0) return "refreshed";
  return rowCount > 0 ? "partial" : "failed";
};

const refreshDataset = async (
  entry: FantasyProsDatasetRefresh,
  dependencies: FantasyProsRefreshDependencies,
  now: Date,
): Promise<FantasyProsRefreshResult> => {
  const { repository } = dependencies;
  const claimed = await repository.claimRefresh({
    dataset: entry.dataset,
    now,
    cadenceMs: entry.cadenceMs,
  });
  if (!claimed) {
    return { dataset: entry.dataset, status: "skipped", requestCount: 0, rowCount: 0 };
  }

  const failed = async (
    rowCount: number,
    error: string,
    throttled: boolean,
  ): Promise<FantasyProsRefreshResult> => {
    const recorded = throttled ? `${fantasyProsThrottleNotice} ${error}` : error;
    dependencies.onError?.(entry.dataset, new Error(recorded));
    await repository.recordRefreshOutcome({
      dataset: entry.dataset,
      now,
      requestCount: entry.requestCount,
      rowCount,
      error: recorded,
      // Retrying a throttled dataset in half an hour spends the very quota
      // that caused the refusal, six requests at a time all day. Leaving the
      // stored timestamp alone makes it wait its full cadence instead.
      ...(throttled ? {} : { retryDelayMs: fantasyProsRetryDelayMs }),
      cadenceMs: entry.cadenceMs,
    });
    return {
      dataset: entry.dataset,
      status: statusFor(rowCount, [error]),
      requestCount: entry.requestCount,
      rowCount,
    };
  };

  try {
    const { rowCount, failures, throttled } = await entry.run(now.toISOString());
    if (failures.length > 0) {
      return await failed(rowCount, failures.join("; "), throttled ?? false);
    }
    await repository.recordRefreshOutcome({
      dataset: entry.dataset,
      now,
      requestCount: entry.requestCount,
      rowCount,
    });
    return { dataset: entry.dataset, status: "refreshed", requestCount: entry.requestCount, rowCount };
  } catch (error) {
    return await failed(0, errorMessage(error), isFantasyProsThrottled(error));
  }
};

export const refreshFantasyProsDatasets = async (
  dependencies: FantasyProsRefreshDependencies,
  entries: readonly FantasyProsDatasetRefresh[],
): Promise<readonly FantasyProsRefreshResult[]> => {
  const now = (dependencies.now ?? (() => new Date()))();
  const results: FantasyProsRefreshResult[] = [];
  for (const entry of entries) {
    results.push(await refreshDataset(entry, dependencies, now));
  }
  return results;
};
