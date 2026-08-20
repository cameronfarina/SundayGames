import {
  JobError,
  type CancelJobAtRunBoundaryInput,
  type CancelJobInput,
  type JobRecord,
} from "../jobs.js";
import { cancelStatusRaceRetryLimit } from "./constants.js";
import { jobFromRow } from "./jobRow.js";
import {
  requiredLockedUpdate,
  requireJobOwnedBy,
  requireRunningLockedJob,
} from "./lookups.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const cancelJob = async (
  context: JobQueueContext,
  input: CancelJobInput,
): Promise<JobRecord> => {
  const now = input.now ?? new Date();
  for (let attempt = 0; attempt < cancelStatusRaceRetryLimit; attempt += 1) {
    const job = await requireJobOwnedBy(context, input.jobId, input.userId);
    if (job.status === "queued") {
      const result = await context.client.query<JobRow>(
        `
UPDATE jobs
SET status = 'canceled',
    cancellation_requested_at = $2,
    finished_at = $2,
    updated_at = $2
WHERE id = $1
  AND user_id = $3
  AND status = 'queued'
RETURNING *;
`.trim(),
        [input.jobId, now, input.userId],
      );
      const row = firstRow(result);
      if (row !== undefined) return jobFromRow(row);
      continue;
    }

    if (job.status === "running") {
      const result = await context.client.query<JobRow>(
        `
UPDATE jobs
SET cancellation_requested_at = $2,
    updated_at = $2
WHERE id = $1
  AND user_id = $3
  AND status = 'running'
RETURNING *;
`.trim(),
        [input.jobId, now, input.userId],
      );
      const row = firstRow(result);
      if (row !== undefined) return jobFromRow(row);
      continue;
    }

    return job;
  }

  const job = await requireJobOwnedBy(context, input.jobId, input.userId);
  if (job.status !== "queued" && job.status !== "running") return job;
  throw new Error("Postgres job cancellation lost too many status races.");
};

export const cancelJobAtRunBoundary = async (
  context: JobQueueContext,
  input: CancelJobAtRunBoundaryInput,
): Promise<JobRecord> => {
  const job = await requireRunningLockedJob(
    context, input.jobId, input.workerId, input.claimLockedAt,
  );
  if (job.cancellationRequestedAt === undefined) {
    throw new JobError("job_not_claimable", "Job has not requested cancellation.");
  }
  const now = input.now ?? new Date();
  const result = await context.client.query<JobRow>(
    `
UPDATE jobs
SET status = 'canceled',
    finished_at = $2,
    updated_at = $2,
    locked_by = NULL,
    locked_at = NULL,
    heartbeat_at = NULL,
    lock_expires_at = NULL
WHERE id = $1
  AND status = 'running'
  AND locked_by = $3
  AND locked_at = $4
RETURNING *;
`.trim(),
    [input.jobId, now, input.workerId, input.claimLockedAt],
  );
  return await requiredLockedUpdate(
    context, result, input.jobId, input.workerId, input.claimLockedAt,
  );
};
