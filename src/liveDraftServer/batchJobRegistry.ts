import type { Owner } from "../../config/league.js";
import type { LiveDraftStrategyKey } from "../modeling/liveDraftStrategies.js";
import type { MockBatch } from "../modeling/mockBatch.js";
import { buildMockResultsReport } from "../modeling/mockResults.js";
import type { MockBatchJob } from "./contracts.js";

export interface BatchJobRegistry {
  add(job: MockBatchJob): void;
  remove(job: MockBatchJob): void;
  prune(): void;
  latest(draftSessionKey: string, watchOwner: Owner): MockBatchJob | undefined;
  get(jobId: string): MockBatchJob | undefined;
  responseFor(job: MockBatchJob): MockBatchJob;
  publishInteractive(request: {
    draftSessionKey: string;
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    commandCount: number;
    batch: MockBatch;
  }): MockBatchJob;
  size(): number;
}

export const createBatchJobRegistry = ({
  now,
  completedJobTtlMs,
  maxCompletedJobs,
}: {
  now: () => Date;
  completedJobTtlMs: number;
  maxCompletedJobs: number;
}): BatchJobRegistry => {
  const jobs = new Map<string, MockBatchJob>();
  const latestIds = new Map<string, string>();
  const scopeKey = (draftSessionKey: string, owner: Owner): string =>
    `${draftSessionKey}\u0000${owner}`;

  const remove = (job: MockBatchJob): void => {
    jobs.delete(job.jobId);
    const key = scopeKey(job.draftSessionKey, job.watchOwner);
    if (latestIds.get(key) === job.jobId) latestIds.delete(key);
  };
  const add = (job: MockBatchJob): void => {
    jobs.set(job.jobId, job);
    latestIds.set(scopeKey(job.draftSessionKey, job.watchOwner), job.jobId);
  };
  const prune = (): void => {
    const cutoff = now().getTime() - completedJobTtlMs;
    const terminal = [...jobs.values()]
      .filter(job => job.status === "complete" || job.status === "failed")
      .sort((left, right) => Date.parse(left.updatedAt) - Date.parse(right.updatedAt));
    for (const job of terminal) {
      if (Date.parse(job.updatedAt) < cutoff) remove(job);
    }
    const retained = terminal.filter(job => jobs.has(job.jobId));
    for (let index = 0; index < retained.length - maxCompletedJobs; index += 1) {
      const job = retained[index];
      if (job) remove(job);
    }
  };
  const latest = (draftSessionKey: string, owner: Owner): MockBatchJob | undefined => {
    const id = latestIds.get(scopeKey(draftSessionKey, owner));
    return id ? jobs.get(id) : undefined;
  };
  const responseFor = (job: MockBatchJob): MockBatchJob => ({
    jobId: job.jobId,
    status: job.status,
    ...(job.source === undefined ? {} : { source: job.source }),
    draftSessionKey: job.draftSessionKey,
    watchOwner: job.watchOwner,
    ...(job.draftMode === undefined ? {} : { draftMode: job.draftMode }),
    ...(job.commandCount === undefined ? {} : { commandCount: job.commandCount }),
    strategyKey: job.strategyKey,
    runStrategyKeys: job.runStrategyKeys,
    ...(job.script === undefined ? {} : { script: job.script }),
    runsPerScenario: job.runsPerScenario,
    totalRuns: job.totalRuns,
    completedRuns: job.completedRuns,
    percent: job.percent,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    ...(job.result === undefined ? {} : { result: job.result }),
    ...(job.error === undefined ? {} : { error: job.error }),
  });
  const publishInteractive = ({
    draftSessionKey,
    watchOwner,
    strategyKey,
    commandCount,
    batch,
  }: {
    draftSessionKey: string;
    watchOwner: Owner;
    strategyKey: LiveDraftStrategyKey;
    commandCount: number;
    batch: MockBatch;
  }): MockBatchJob => {
    if (!batch.runs[0]) throw new Error("Mock draft completion did not produce a run.");
    prune();
    const timestamp = now().toISOString();
    const job: MockBatchJob = {
      jobId: `mock-complete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "complete",
      source: "interactive-complete",
      draftSessionKey,
      watchOwner,
      draftMode: "interactive-mock",
      commandCount,
      strategyKey,
      runStrategyKeys: [strategyKey],
      runsPerScenario: 1,
      totalRuns: 1,
      completedRuns: 1,
      percent: 100,
      startedAt: timestamp,
      updatedAt: timestamp,
      result: buildMockResultsReport(batch, strategyKey, [strategyKey], undefined, ["Completed mock draft"], watchOwner),
    };
    add(job);
    prune();
    return job;
  };
  return {
    add,
    remove,
    prune,
    latest,
    get: jobId => jobs.get(jobId),
    responseFor,
    publishInteractive,
    size: () => jobs.size,
  };
};
