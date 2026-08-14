import type { MockBatchResourceManager } from "../mockBatchResourceManager.js";
import type { MockDraftScript } from "../modeling/mockScript.js";
import { createBatchJobRegistry } from "./batchJobRegistry.js";
import { runMockBatchJob } from "./batchJobRunner.js";
import type { CreateLiveDraftServerOptions, MockBatchJob } from "./contracts.js";
import { mockBatchStrategySequence } from "./mockInput.js";
import type { BatchService, LiveDraftData } from "./runtimeContracts.js";

export const createBatchService = ({
  options,
  data,
  now,
  completedJobTtlMs,
  maxCompletedJobs,
  resourceManager,
}: {
  options: CreateLiveDraftServerOptions;
  data: LiveDraftData;
  now: () => Date;
  completedJobTtlMs: number;
  maxCompletedJobs: number;
  resourceManager: MockBatchResourceManager;
}): BatchService => {
  const registry = createBatchJobRegistry({ now, completedJobTtlMs, maxCompletedJobs });
  const start = ({
    draftSessionKey,
    watchOwner,
    strategyKey,
    runsPerScenario,
    seedPrefix,
    script,
  }: {
    draftSessionKey: string;
    watchOwner: MockBatchJob["watchOwner"];
    strategyKey: MockBatchJob["strategyKey"];
    runsPerScenario: number;
    seedPrefix: string;
    script?: MockDraftScript;
  }): MockBatchJob => {
    registry.prune();
    const timestamp = now().toISOString();
    const totalRuns = runsPerScenario * Math.max(1, script?.buildAround?.prices.length ?? 1);
    const job: MockBatchJob = {
      jobId: `mock-batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "queued",
      draftSessionKey,
      watchOwner,
      strategyKey,
      runStrategyKeys: mockBatchStrategySequence(strategyKey, totalRuns, runsPerScenario),
      ...(script === undefined ? {} : { script }),
      runsPerScenario,
      totalRuns,
      completedRuns: 0,
      percent: 0,
      startedAt: timestamp,
      updatedAt: timestamp,
    };
    registry.add(job);
    try {
      resourceManager.submit(
        options.mockBatchResourceScope ?? { accountId: "standalone", seasonId: draftSessionKey },
        () => runMockBatchJob({ job, runsPerScenario, seedPrefix, options, data, now, registry }),
      );
    } catch (error) {
      registry.remove(job);
      throw error;
    }
    return job;
  };
  return {
    latestCompleteReport: (draftSessionKey, owner) => {
      const job = registry.latest(draftSessionKey, owner);
      if (job?.source === "interactive-complete") return undefined;
      return job?.status === "complete" ? job.result : undefined;
    },
    publishInteractiveResults: registry.publishInteractive,
    responseFor: registry.responseFor,
    start,
    latestJob: registry.latest,
    job: registry.get,
    prune: registry.prune,
    canDispose: () => {
      registry.prune();
      return registry.size() === 0;
    },
  };
};
