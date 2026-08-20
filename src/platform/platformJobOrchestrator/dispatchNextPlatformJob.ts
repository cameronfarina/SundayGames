import { JobError, type JobRecord } from "../jobs.js";
import type { DispatchNextPlatformJobInput } from "./handlerContracts.js";
import { startIntervalHeartbeat } from "./heartbeat.js";
import { runClaimedPlatformJob } from "./runClaimedPlatformJob.js";

const isBoundaryCancellationError = (error: unknown): boolean =>
  error instanceof JobError && error.code === "job_not_claimable";

export const dispatchNextPlatformJob = async ({
  repository,
  workerId,
  handlers,
  now,
  lockTtlMs,
  jobKinds,
  heartbeatIntervalMs,
  heartbeatScheduler = startIntervalHeartbeat,
}: DispatchNextPlatformJobInput): Promise<JobRecord | null> => {
  const dispatchAt = now ?? new Date();
  const job = await repository.claimNextJob({
    workerId,
    now: dispatchAt,
    lockTtlMs,
    kinds: jobKinds,
  });

  if (job === null) return null;
  const claimLockedAt = job.lockedAt;
  if (claimLockedAt === undefined) {
    throw new Error(`Claimed job ${job.id} did not include its execution token.`);
  }

  try {
    const handledJob = await runClaimedPlatformJob({
      repository,
      workerId,
      job,
      handlers,
      lockTtlMs,
      heartbeatIntervalMs,
      heartbeatScheduler,
    });
    const boundaryJob = handledJob.latestJob.cancellationRequestedAt === undefined
      ? await repository.heartbeatJob({
          jobId: job.id,
          workerId,
          claimLockedAt,
          lockTtlMs,
        })
      : handledJob.latestJob;
    const completedAt = now ?? new Date();

    if (boundaryJob.cancellationRequestedAt !== undefined) {
      return await repository.cancelJobAtRunBoundary({
        jobId: job.id,
        workerId,
        claimLockedAt,
        now: completedAt,
      });
    }

    return await repository.completeJob({
      jobId: job.id,
      workerId,
      claimLockedAt,
      resultSummary: handledJob.resultSummary,
      now: completedAt,
    });
  } catch (error) {
    const failedAt = now ?? new Date();

    if (isBoundaryCancellationError(error)) {
      return await repository.cancelJobAtRunBoundary({
        jobId: job.id,
        workerId,
        claimLockedAt,
        now: failedAt,
      });
    }

    return await repository.failJob({
      jobId: job.id,
      workerId,
      claimLockedAt,
      error,
      now: failedAt,
    });
  }
};
