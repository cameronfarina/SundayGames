import type { JobRecord } from "./contracts.js";
import { JobError } from "./errors.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";

export const findJobForUser = (
  store: InMemoryJobStore,
  jobId: string,
  userId: string,
): JobRecord => {
  const job = store.jobById(jobId);

  if (job === undefined) {
    throw new JobError("job_not_found", "Job was not found.");
  }

  if (job.userId !== userId) {
    throw new JobError("job_owner_required", "Job belongs to another user.");
  }

  return job;
};

export const findRunningLockedJob = (
  store: InMemoryJobStore,
  jobId: string,
  workerId: string,
  claimLockedAt: Date,
): JobRecord => {
  const job = store.jobById(jobId);

  if (job === undefined) {
    throw new JobError("job_not_found", "Job was not found.");
  }

  if (job.status !== "running") {
    throw new JobError("job_not_running", "Job is not running.");
  }

  if (job.workerId !== workerId) {
    throw new JobError("job_lock_mismatch", "Job is locked by another worker.");
  }
  if (job.lockedAt?.getTime() !== claimLockedAt.getTime()) {
    throw new JobError("job_lock_mismatch", "Worker no longer owns its claimed execution.");
  }

  return job;
};
