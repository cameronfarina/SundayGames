import {
  defaultLockTtlMs,
  type HeartbeatJobInput,
  type JobRecord,
  type UpdateJobProgressInput,
} from "../jobs.js";
import { jsonbParameter } from "./json.js";
import { requiredLockedUpdate, requireRunningLockedJob } from "./lookups.js";
import type { JobQueueContext, JobRow } from "./types.js";

export const updateJobProgress = async (
  context: JobQueueContext,
  input: UpdateJobProgressInput,
): Promise<JobRecord> => {
  await requireRunningLockedJob(context, input.jobId, input.workerId, input.claimLockedAt);
  const now = input.now ?? new Date();
  const result = await context.client.query<JobRow>(
    `
UPDATE jobs
SET progress_json = $2::jsonb,
    heartbeat_at = $3,
    updated_at = $3
WHERE id = $1
  AND status = 'running'
  AND locked_by = $4
  AND locked_at = $5
RETURNING *;
`.trim(),
    [input.jobId, jsonbParameter(input.progress), now, input.workerId, input.claimLockedAt],
  );
  return await requiredLockedUpdate(context, result, input.jobId, input.workerId, input.claimLockedAt);
};

export const heartbeatJob = async (
  context: JobQueueContext,
  input: HeartbeatJobInput,
): Promise<JobRecord> => {
  await requireRunningLockedJob(context, input.jobId, input.workerId, input.claimLockedAt);
  const now = input.now ?? new Date();
  const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
  const lockExpiresAt = new Date(now.getTime() + lockTtlMs);
  const result = await context.client.query<JobRow>(
    `
UPDATE jobs
SET heartbeat_at = $2,
    lock_expires_at = $3,
    updated_at = $2
WHERE id = $1
  AND status = 'running'
  AND locked_by = $4
  AND locked_at = $5
RETURNING *;
`.trim(),
    [input.jobId, now, lockExpiresAt, input.workerId, input.claimLockedAt],
  );
  return await requiredLockedUpdate(context, result, input.jobId, input.workerId, input.claimLockedAt);
};
