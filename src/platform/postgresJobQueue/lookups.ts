import { JobError, type JobRecord, type SubmitJobInput } from "../jobs.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../postgresPlatformStore.js";
import { jobFromRow } from "./jobRow.js";
import { selectJobByIdSql } from "./sql.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const findByIdempotencyKey = async (
  context: JobQueueContext,
  input: SubmitJobInput,
  client: PostgresQueryClient = context.client,
): Promise<JobRecord | null> => {
  const result = await client.query<JobRow>(
    `
SELECT *
FROM jobs
WHERE user_id = $1
  AND league_id = $2
  AND league_season_id = $3
  AND idempotency_key = $4
`.trim(),
    [input.userId, input.leagueId, input.seasonId, input.idempotencyKey],
  );
  const row = firstRow(result);
  return row === undefined ? null : jobFromRow(row);
};

export const findById = async (
  context: JobQueueContext,
  jobId: string,
): Promise<JobRecord | null> => {
  const result = await context.client.query<JobRow>(selectJobByIdSql, [jobId]);
  const row = firstRow(result);
  return row === undefined ? null : jobFromRow(row);
};

export const requireJobOwnedBy = async (
  context: JobQueueContext,
  jobId: string,
  userId: string,
): Promise<JobRecord> => {
  const job = await findById(context, jobId);
  if (job === null) throw new JobError("job_not_found", "Job was not found.");
  if (job.userId !== userId) {
    throw new JobError("job_owner_required", "Job belongs to another user.");
  }
  return job;
};

export const requireRunningLockedJob = async (
  context: JobQueueContext,
  jobId: string,
  workerId: string,
): Promise<JobRecord> => {
  const job = await findById(context, jobId);
  if (job === null) throw new JobError("job_not_found", "Job was not found.");
  if (job.status !== "running") {
    throw new JobError("job_not_running", "Job is not running.");
  }
  if (job.workerId !== workerId) {
    throw new JobError("job_lock_mismatch", "Job is locked by another worker.");
  }
  return job;
};

export const requiredLockedUpdate = async (
  context: JobQueueContext,
  result: PostgresQueryResult<JobRow>,
  jobId: string,
  workerId: string,
): Promise<JobRecord> => {
  const row = firstRow(result);
  if (row !== undefined) return jobFromRow(row);
  await requireRunningLockedJob(context, jobId, workerId);
  throw new Error("Postgres job lifecycle update did not return an updated row.");
};

export const requiredCompletionUpdate = async (
  context: JobQueueContext,
  result: PostgresQueryResult<JobRow>,
  jobId: string,
  workerId: string,
): Promise<JobRecord> => {
  const row = firstRow(result);
  if (row !== undefined) return jobFromRow(row);
  const job = await requireRunningLockedJob(context, jobId, workerId);
  if (job.cancellationRequestedAt !== undefined) {
    throw new JobError("job_not_claimable", "Job has requested cancellation.");
  }
  throw new Error("Postgres job completion did not return an updated row.");
};
