import { defaultLockTtlMs } from "./constants.js";
import type {
  HeartbeatJobInput,
  JobRecord,
  UpdateJobProgressInput,
} from "./contracts.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { findRunningLockedJob } from "./lookups.js";

export const updateJobProgress = (
  store: InMemoryJobStore,
  input: UpdateJobProgressInput,
): JobRecord => {
  const now = input.now ?? new Date();
  const job = findRunningLockedJob(store, input.jobId, input.workerId, input.claimLockedAt);

  job.progress = { ...input.progress };
  job.heartbeatAt = now;
  job.updatedAt = now;

  return job;
};

export const heartbeatJob = (
  store: InMemoryJobStore,
  input: HeartbeatJobInput,
): JobRecord => {
  const now = input.now ?? new Date();
  const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
  const job = findRunningLockedJob(store, input.jobId, input.workerId, input.claimLockedAt);

  job.heartbeatAt = now;
  job.lockExpiresAt = new Date(now.getTime() + lockTtlMs);
  job.updatedAt = now;

  return job;
};
