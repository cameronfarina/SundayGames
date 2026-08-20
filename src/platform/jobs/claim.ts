import { defaultLockTtlMs } from "./constants.js";
import type { ClaimNextJobInput, JobRecord } from "./contracts.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";

const isClaimable = (job: JobRecord, input: ClaimNextJobInput, now: Date): boolean =>
  (input.kinds === undefined || input.kinds.includes(job.kind)) &&
  (
    job.status === "queued" ||
    (
      job.status === "running" &&
      job.cancellationRequestedAt === undefined &&
      job.lockExpiresAt !== undefined &&
      job.lockExpiresAt.getTime() <= now.getTime()
    )
  );

const byOldestCreation = (left: JobRecord, right: JobRecord): number => {
  const createdAtOrder = left.createdAt.getTime() - right.createdAt.getTime();

  return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
};

export const claimNextJob = (
  store: InMemoryJobStore,
  input: ClaimNextJobInput,
): JobRecord | null => {
  const now = input.now ?? new Date();
  const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
  const jobs = store.values();
  const lastClaimedAt = (candidate: JobRecord): number => Math.max(
    ...jobs
      .filter(job => job.kind === candidate.kind && job.userId === candidate.userId)
      .map(job => job.startedAt?.getTime() ?? Number.NEGATIVE_INFINITY),
  );
  const job = jobs.filter(candidate => isClaimable(candidate, input, now)).sort((left, right) => {
    const fairnessOrder = lastClaimedAt(left) - lastClaimedAt(right);
    return fairnessOrder === 0 ? byOldestCreation(left, right) : fairnessOrder;
  })[0];

  if (job === undefined) return null;

  job.status = "running";
  job.workerId = input.workerId;
  job.lockedAt = now;
  job.heartbeatAt = now;
  job.lockExpiresAt = new Date(now.getTime() + lockTtlMs);
  job.startedAt = job.startedAt ?? now;
  job.updatedAt = now;

  return job;
};
