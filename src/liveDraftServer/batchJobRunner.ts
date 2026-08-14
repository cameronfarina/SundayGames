import { buildMockResultsReport } from "../modeling/mockResults.js";
import type { BatchJobRegistry } from "./batchJobRegistry.js";
import { runBatch } from "./batchJobRunnerBatch.js";
import { updateProgress, type RunJobContext } from "./batchJobRunnerContext.js";
import { buildAroundRunLabelsFor } from "./mockInput.js";

export const runMockBatchJob = async ({
  registry,
  ...context
}: RunJobContext & { registry: BatchJobRegistry }): Promise<void> => {
  const { job, now } = context;
  job.status = "running";
  job.updatedAt = now().toISOString();
  try {
    const batch = await runBatch(context);
    updateProgress(job, job.totalRuns, now);
    job.status = "complete";
    job.result = buildMockResultsReport(
      batch,
      job.strategyKey,
      job.runStrategyKeys,
      job.script,
      buildAroundRunLabelsFor(job.script, context.runsPerScenario, job.runStrategyKeys),
      job.watchOwner,
    );
    job.updatedAt = now().toISOString();
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "Unknown mock batch error.";
    job.updatedAt = now().toISOString();
  } finally {
    registry.prune();
  }
};
