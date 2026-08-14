import {
  sanitizeJobError,
  type FailJobInput,
  type JobRecord,
} from "../jobs.js";
import { cancelJobAtRunBoundary } from "./cancel.js";
import { jobFromRow } from "./jobRow.js";
import { jsonbParameter } from "./json.js";
import { requireRunningLockedJob } from "./lookups.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const failJob = async (
  context: JobQueueContext,
  input: FailJobInput,
): Promise<JobRecord> => {
  const job = await requireRunningLockedJob(context, input.jobId, input.workerId);
  if (job.cancellationRequestedAt !== undefined) {
    return await cancelJobAtRunBoundary(context, {
      jobId: input.jobId,
      workerId: input.workerId,
      now: input.now,
    });
  }

  const now = input.now ?? new Date();
  const attempts = job.attempts + 1;
  const sanitizedError = sanitizeJobError(input.error);
  const status = attempts < job.maxAttempts ? "queued" : "failed";
  const finishedAt = status === "failed" ? now : null;
  const result = await context.client.query<JobRow>(
    `
UPDATE jobs
SET status = $2,
    attempt_count = $3,
    sanitized_error_json = $4::jsonb,
    error_summary = $5,
    finished_at = $6,
    updated_at = $7,
    locked_by = NULL,
    locked_at = NULL,
    heartbeat_at = NULL,
    lock_expires_at = NULL
WHERE id = $1
  AND status = 'running'
  AND locked_by = $8
  AND cancellation_requested_at IS NULL
RETURNING *;
`.trim(),
    [
      input.jobId,
      status,
      attempts,
      jsonbParameter(sanitizedError),
      sanitizedError.message,
      finishedAt,
      now,
      input.workerId,
    ],
  );
  const row = firstRow(result);
  if (row !== undefined) return jobFromRow(row);

  const currentJob = await requireRunningLockedJob(context, input.jobId, input.workerId);
  if (currentJob.cancellationRequestedAt !== undefined) {
    return await cancelJobAtRunBoundary(context, {
      jobId: input.jobId,
      workerId: input.workerId,
      now,
    });
  }
  throw new Error("Postgres job failure update did not return an updated row.");
};
