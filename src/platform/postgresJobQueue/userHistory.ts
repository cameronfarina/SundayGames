import { JobError, type JobRecord } from "../jobs.js";
import {
  jobHistoryPageFor,
  normalizedJobHistoryLimit,
  parseJobHistoryCursor,
  type JobHistoryPage,
  type ListJobsForUserInput,
} from "../jobHistory.js";
import { jobFromRow } from "./jobRow.js";
import { pruneTerminalHistory } from "./prune.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const listJobsForUser = async (
  context: JobQueueContext,
  userId: string,
): Promise<JobRecord[]> => {
  const result = await context.client.query<JobRow>(
    "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at ASC, id ASC",
    [userId],
  );
  return result.rows.map(jobFromRow);
};

export const listJobPageForUser = async (
  context: JobQueueContext,
  input: ListJobsForUserInput,
): Promise<JobHistoryPage> => {
  const cursor = input.cursor === undefined ? undefined : parseJobHistoryCursor(input.cursor);
  if (cursor === null) {
    throw new JobError("invalid_job_cursor", "Job history cursor is invalid.");
  }
  const limit = normalizedJobHistoryLimit(input.limit);
  return await context.client.transaction(async transactionClient => {
    await pruneTerminalHistory(input.userId, transactionClient);
    const result = await transactionClient.query<JobRow>(
      `
SELECT *
FROM jobs
WHERE user_id = $1
  AND (
    $2::timestamptz IS NULL
    OR created_at < $2
    OR (created_at = $2 AND id < $3)
  )
ORDER BY created_at DESC, id DESC
LIMIT $4;
`.trim(),
      [input.userId, cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1],
    );
    return jobHistoryPageFor(result.rows.map(jobFromRow), limit);
  });
};

export const fetchJobForUser = async (
  context: JobQueueContext,
  jobId: string,
  userId: string,
): Promise<JobRecord | null> => {
  const result = await context.client.query<JobRow>(
    "SELECT * FROM jobs WHERE id = $1 AND user_id = $2",
    [jobId, userId],
  );
  const row = firstRow(result);
  return row === undefined ? null : jobFromRow(row);
};
