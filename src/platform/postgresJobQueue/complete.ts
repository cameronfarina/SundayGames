import type { CompleteJobInput, JobRecord } from "../jobs.js";
import { completedProgress } from "./constants.js";
import { jsonbParameter } from "./json.js";
import { requiredCompletionUpdate, requireRunningLockedJob } from "./lookups.js";
import type { JobQueueContext, JobRow } from "./types.js";

export const completeJob = async (
  context: JobQueueContext,
  input: CompleteJobInput,
): Promise<JobRecord> => {
  await requireRunningLockedJob(context, input.jobId, input.workerId, input.claimLockedAt);
  const now = input.now ?? new Date();
  const result = await context.client.query<JobRow>(
    `
UPDATE jobs
SET status = 'completed',
    progress_json = $2::jsonb,
    result_summary_json = $3::jsonb,
    finished_at = $4,
    updated_at = $4,
    locked_by = NULL,
    locked_at = NULL,
    heartbeat_at = NULL,
    lock_expires_at = NULL
WHERE id = $1
  AND status = 'running'
  AND locked_by = $5
  AND locked_at = $6
  AND cancellation_requested_at IS NULL
RETURNING *;
`.trim(),
    [
      input.jobId,
      jsonbParameter(completedProgress),
      jsonbParameter(input.resultSummary),
      now,
      input.workerId,
      input.claimLockedAt,
    ],
  );
  return await requiredCompletionUpdate(
    context, result, input.jobId, input.workerId, input.claimLockedAt,
  );
};
