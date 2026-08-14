import { defaultMaxAttempts, queuedProgress } from "./constants.js";
import type { JobRecord, SubmitJobInput } from "./contracts.js";
import { createJobId } from "./identifiers.js";

export const createQueuedJob = (
  input: SubmitJobInput,
  inputHash: string,
  now: Date,
): JobRecord => ({
  id: createJobId(),
  userId: input.userId,
  leagueId: input.leagueId,
  seasonId: input.seasonId,
  kind: input.kind,
  status: "queued",
  inputJson: input.inputJson,
  inputHash,
  idempotencyKey: input.idempotencyKey,
  progress: queuedProgress(),
  attempts: 0,
  maxAttempts: input.maxAttempts ?? defaultMaxAttempts,
  workerId: undefined,
  lockedAt: undefined,
  heartbeatAt: undefined,
  lockExpiresAt: undefined,
  startedAt: undefined,
  finishedAt: undefined,
  cancellationRequestedAt: undefined,
  resultSummary: undefined,
  sanitizedError: undefined,
  createdAt: now,
  updatedAt: now,
});

export const clearJobLock = (job: JobRecord): void => {
  job.workerId = undefined;
  job.lockedAt = undefined;
  job.heartbeatAt = undefined;
  job.lockExpiresAt = undefined;
};

export const resetJobForRerun = (job: JobRecord, now: Date): JobRecord => {
  job.status = "queued";
  job.progress = queuedProgress();
  job.attempts = 0;
  clearJobLock(job);
  job.startedAt = undefined;
  job.finishedAt = undefined;
  job.cancellationRequestedAt = undefined;
  job.resultSummary = undefined;
  job.sanitizedError = undefined;
  job.createdAt = now;
  job.updatedAt = now;

  return job;
};
