import type { JobRecord } from "../jobs.js";
import type { PlatformJobHandlerContext } from "./handlerContracts.js";
import type { PlatformJobRepository } from "./repositoryContracts.js";

export const handlerContextFor = (
  repository: PlatformJobRepository,
  job: JobRecord,
  workerId: string,
  observeJob: (job: JobRecord) => JobRecord,
): PlatformJobHandlerContext => {
  const claimLockedAt = job.lockedAt;
  if (claimLockedAt === undefined) {
    throw new Error(`Claimed job ${job.id} did not include its execution token.`);
  }
  return ({
  job,
  workerId,
  updateProgress: async (progress, now) =>
    observeJob(await repository.updateProgress({
      jobId: job.id,
      workerId,
      claimLockedAt,
      progress,
      now,
    })),
  heartbeat: async input =>
    observeJob(await repository.heartbeatJob({
      jobId: job.id,
      workerId,
      claimLockedAt,
      now: input?.now,
      lockTtlMs: input?.lockTtlMs,
    })),
  });
};
