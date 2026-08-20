import type {
  CancelJobAtRunBoundaryInput,
  CancelJobInput,
  JobRecord,
} from "./contracts.js";
import { JobError } from "./errors.js";
import { pruneTerminalHistory } from "./history.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { findJobForUser, findRunningLockedJob } from "./lookups.js";
import { clearJobLock } from "./recordLifecycle.js";

export const cancelJob = (store: InMemoryJobStore, input: CancelJobInput): JobRecord => {
  const now = input.now ?? new Date();
  const job = findJobForUser(store, input.jobId, input.userId);

  if (job.status === "queued") {
    job.status = "canceled";
    job.cancellationRequestedAt = now;
    job.finishedAt = now;
    job.updatedAt = now;
    pruneTerminalHistory(store, job.userId);
    return job;
  }

  if (job.status === "running") {
    job.cancellationRequestedAt = now;
    job.updatedAt = now;
  }

  return job;
};

export const cancelJobAtRunBoundary = (
  store: InMemoryJobStore,
  input: CancelJobAtRunBoundaryInput,
): JobRecord => {
  const now = input.now ?? new Date();
  const job = findRunningLockedJob(store, input.jobId, input.workerId, input.claimLockedAt);

  if (job.cancellationRequestedAt === undefined) {
    throw new JobError("job_not_claimable", "Job has not requested cancellation.");
  }

  job.status = "canceled";
  job.finishedAt = now;
  job.updatedAt = now;
  clearJobLock(job);
  pruneTerminalHistory(store, job.userId);

  return job;
};
