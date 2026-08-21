import type { CompleteJobInput, FailJobInput, JobRecord } from "./contracts.js";
import { sanitizeJobError } from "./errorSanitizer.js";
import { JobError } from "./errors.js";
import { pruneTerminalHistory } from "./history.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { findRunningLockedJob } from "./lookups.js";
import { clearJobLock } from "./recordLifecycle.js";

export const completeJob = (
  store: InMemoryJobStore,
  input: CompleteJobInput,
): JobRecord => {
  const now = input.now ?? new Date();
  const job = findRunningLockedJob(store, input.jobId, input.workerId);

  if (job.cancellationRequestedAt !== undefined) {
    throw new JobError("job_not_claimable", "Job has requested cancellation.");
  }

  job.status = "completed";
  job.progress = { completed: 1, total: 1, message: "Completed" };
  job.resultSummary = input.resultSummary;
  job.finishedAt = now;
  job.updatedAt = now;
  clearJobLock(job);
  pruneTerminalHistory(store, job.userId);

  return job;
};

export const failJob = (store: InMemoryJobStore, input: FailJobInput): JobRecord => {
  const now = input.now ?? new Date();
  const job = findRunningLockedJob(store, input.jobId, input.workerId);

  if (job.cancellationRequestedAt !== undefined) {
    job.status = "canceled";
    job.finishedAt = now;
    job.updatedAt = now;
    clearJobLock(job);
    pruneTerminalHistory(store, job.userId);

    return job;
  }

  job.attempts += 1;
  job.sanitizedError = sanitizeJobError(input.error);
  job.updatedAt = now;
  clearJobLock(job);

  if (job.attempts < job.maxAttempts) {
    job.status = "queued";
    return job;
  }

  job.status = "failed";
  job.finishedAt = now;
  pruneTerminalHistory(store, job.userId);

  return job;
};
