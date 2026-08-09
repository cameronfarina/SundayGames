import {
  JobError,
  createJobId,
  defaultLockTtlMs,
  defaultMaxAttempts,
  hashJobInput,
  isTerminalJob,
  jobRerunIdempotencyKeyFor,
  sanitizeJobError,
  type CancelJobAtRunBoundaryInput,
  type CancelJobInput,
  type ClaimNextJobInput,
  type CompleteJobInput,
  type FailJobInput,
  type HeartbeatJobInput,
  type JobKind,
  type JobProgress,
  type JobRecord,
  type JobRepository,
  type JobStatus,
  type JsonValue,
  type RerunJobInput,
  type SanitizedJobError,
  type SubmitJobInput,
  type UpdateJobProgressInput,
} from "./jobs.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";

export interface PostgresTransactionalQueryClient extends PostgresQueryClient {
  transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T>;
}

interface JobRow {
  id: string;
  user_id: string;
  league_id: string;
  league_season_id: string;
  kind: string;
  status: string;
  idempotency_key: string;
  input_hash: string;
  input_json: unknown;
  progress_json: unknown;
  result_summary_json: unknown;
  attempt_count: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: Date | string | null;
  heartbeat_at: Date | string | null;
  lock_expires_at: Date | string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  cancellation_requested_at: Date | string | null;
  sanitized_error_json: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

const queuedProgress: JobProgress = { completed: 0, total: 1, message: "Queued" };
const completedProgress: JobProgress = { completed: 1, total: 1, message: "Completed" };
const cancelStatusRaceRetryLimit = 3;

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const jsonbParameter = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value);

const jsonValueFromDb = (value: unknown): JsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return JSON.parse(JSON.stringify(value)) as JsonValue;
};

const isJsonObject = (value: JsonValue | undefined): value is Record<string, JsonValue | undefined> =>
  value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value);

const dateFromDb = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requiredDateFromDb = (field: string, value: Date | string): Date => {
  const date = dateFromDb(value);
  if (date === undefined) {
    throw new Error(`Postgres jobs row has invalid ${field}.`);
  }

  return date;
};

const progressFromDb = (value: unknown): JobProgress => {
  const jsonValue = jsonValueFromDb(value);
  if (isJsonObject(jsonValue)) {
    return {
      completed: Number(jsonValue.completed ?? 0),
      total: Number(jsonValue.total ?? 1),
      message: typeof jsonValue.message === "string" ? jsonValue.message : "",
    };
  }

  return { ...queuedProgress };
};

const sanitizedErrorFromDb = (value: unknown): SanitizedJobError | undefined => {
  const jsonValue = jsonValueFromDb(value);
  if (isJsonObject(jsonValue)) {
    const name = typeof jsonValue.name === "string" ? jsonValue.name : undefined;
    const message = typeof jsonValue.message === "string" ? jsonValue.message : undefined;

    return name === undefined || message === undefined ? undefined : { name, message };
  }

  return undefined;
};

const jobFromRow = (row: JobRow): JobRecord => ({
  id: row.id,
  userId: row.user_id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  kind: row.kind as JobKind,
  status: row.status as JobStatus,
  inputJson: jsonValueFromDb(row.input_json) ?? null,
  inputHash: row.input_hash,
  idempotencyKey: row.idempotency_key,
  progress: progressFromDb(row.progress_json),
  attempts: Number(row.attempt_count),
  maxAttempts: Number(row.max_attempts),
  workerId: row.locked_by ?? undefined,
  lockedAt: dateFromDb(row.locked_at),
  heartbeatAt: dateFromDb(row.heartbeat_at),
  lockExpiresAt: dateFromDb(row.lock_expires_at),
  startedAt: dateFromDb(row.started_at),
  finishedAt: dateFromDb(row.finished_at),
  cancellationRequestedAt: dateFromDb(row.cancellation_requested_at),
  resultSummary: jsonValueFromDb(row.result_summary_json),
  sanitizedError: sanitizedErrorFromDb(row.sanitized_error_json),
  createdAt: requiredDateFromDb("created_at", row.created_at),
  updatedAt: requiredDateFromDb("updated_at", row.updated_at),
});

const selectJobByIdSql = "SELECT * FROM jobs WHERE id = $1";

export const claimNextJobSql = `
WITH candidate AS (
  SELECT id
  FROM jobs
  WHERE
    ($4::text[] IS NULL OR kind = ANY($4::text[]))
    AND (
      (status = 'queued' AND available_at <= $1)
      OR (
        status = 'running'
        AND cancellation_requested_at IS NULL
        AND lock_expires_at IS NOT NULL
        AND lock_expires_at <= $1
      )
    )
  ORDER BY created_at ASC, id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE jobs
SET status = 'running',
    locked_by = $2,
    locked_at = $1,
    heartbeat_at = $1,
    lock_expires_at = $3,
    started_at = COALESCE(started_at, $1),
    updated_at = $1
FROM candidate
WHERE jobs.id = candidate.id
RETURNING jobs.*;
`.trim();

export class PostgresJobQueue implements JobRepository {
  readonly #client: PostgresTransactionalQueryClient;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#client = client;
  }

  async submit(input: SubmitJobInput): Promise<JobRecord> {
    const now = input.now ?? new Date();
    const inputHash = hashJobInput(input.inputJson);
    const result = await this.#client.query<JobRow>(
      `
INSERT INTO jobs (
  id,
  user_id,
  league_id,
  league_season_id,
  kind,
  status,
  idempotency_key,
  input_hash,
  input_json,
  progress_json,
  attempt_count,
  max_attempts,
  available_at,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8::jsonb, $9::jsonb, 0, $10, $11, $11, $11)
ON CONFLICT ON CONSTRAINT jobs_user_league_season_idempotency_key DO NOTHING
RETURNING *;
`.trim(),
      [
        createJobId(),
        input.userId,
        input.leagueId,
        input.seasonId,
        input.kind,
        input.idempotencyKey,
        inputHash,
        jsonbParameter(input.inputJson),
        jsonbParameter(queuedProgress),
        input.maxAttempts ?? defaultMaxAttempts,
        now,
      ],
    );
    const inserted = firstRow(result);
    if (inserted !== undefined) return jobFromRow(inserted);

    const existing = await this.#findByIdempotencyKey(input);
    if (existing === null) {
      throw new Error("Postgres job idempotency conflict did not return an existing row.");
    }
    if (existing.inputHash !== inputHash) {
      throw new JobError(
        "idempotency_conflict",
        "A job already exists for this idempotency key with different input.",
      );
    }

    return existing;
  }

  async claimNextJob(input: ClaimNextJobInput): Promise<JobRecord | null> {
    const now = input.now ?? new Date();
    const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
    const lockExpiresAt = new Date(now.getTime() + lockTtlMs);

    return await this.#client.transaction(async transactionClient => {
      const result = await transactionClient.query<JobRow>(claimNextJobSql, [
        now,
        input.workerId,
        lockExpiresAt,
        input.kinds === undefined ? null : [...input.kinds],
      ]);
      const row = firstRow(result);

      return row === undefined ? null : jobFromRow(row);
    });
  }

  async updateProgress(input: UpdateJobProgressInput): Promise<JobRecord> {
    await this.#requireRunningLockedJob(input.jobId, input.workerId);
    const now = input.now ?? new Date();
    const result = await this.#client.query<JobRow>(
      `
UPDATE jobs
SET progress_json = $2::jsonb,
    heartbeat_at = $3,
    updated_at = $3
WHERE id = $1
  AND status = 'running'
  AND locked_by = $4
RETURNING *;
`.trim(),
      [input.jobId, jsonbParameter(input.progress), now, input.workerId],
    );

    return await this.#requiredLockedUpdate(result, input.jobId, input.workerId);
  }

  async heartbeatJob(input: HeartbeatJobInput): Promise<JobRecord> {
    await this.#requireRunningLockedJob(input.jobId, input.workerId);
    const now = input.now ?? new Date();
    const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
    const lockExpiresAt = new Date(now.getTime() + lockTtlMs);
    const result = await this.#client.query<JobRow>(
      `
UPDATE jobs
SET heartbeat_at = $2,
    lock_expires_at = $3,
    updated_at = $2
WHERE id = $1
  AND status = 'running'
  AND locked_by = $4
RETURNING *;
`.trim(),
      [input.jobId, now, lockExpiresAt, input.workerId],
    );

    return await this.#requiredLockedUpdate(result, input.jobId, input.workerId);
  }

  async completeJob(input: CompleteJobInput): Promise<JobRecord> {
    await this.#requireRunningLockedJob(input.jobId, input.workerId);
    const now = input.now ?? new Date();
    const result = await this.#client.query<JobRow>(
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
  AND cancellation_requested_at IS NULL
RETURNING *;
`.trim(),
      [
        input.jobId,
        jsonbParameter(completedProgress),
        jsonbParameter(input.resultSummary),
        now,
        input.workerId,
      ],
    );

    return await this.#requiredCompletionUpdate(result, input.jobId, input.workerId);
  }

  async failJob(input: FailJobInput): Promise<JobRecord> {
    const job = await this.#requireRunningLockedJob(input.jobId, input.workerId);
    if (job.cancellationRequestedAt !== undefined) {
      return await this.cancelJobAtRunBoundary({
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
    const result = await this.#client.query<JobRow>(
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

    return await this.#requiredFailureUpdate(result, input.jobId, input.workerId, now);
  }

  async cancelJob(input: CancelJobInput): Promise<JobRecord> {
    const now = input.now ?? new Date();

    for (let attempt = 0; attempt < cancelStatusRaceRetryLimit; attempt += 1) {
      const job = await this.#requireJobOwnedBy(input.jobId, input.userId);

      if (job.status === "queued") {
        const result = await this.#client.query<JobRow>(
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
        const result = await this.#client.query<JobRow>(
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

    const job = await this.#requireJobOwnedBy(input.jobId, input.userId);
    if (job.status !== "queued" && job.status !== "running") return job;

    throw new Error("Postgres job cancellation lost too many status races.");
  }

  async cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): Promise<JobRecord> {
    const job = await this.#requireRunningLockedJob(input.jobId, input.workerId);
    if (job.cancellationRequestedAt === undefined) {
      throw new JobError("job_not_claimable", "Job has not requested cancellation.");
    }

    const now = input.now ?? new Date();
    const result = await this.#client.query<JobRow>(
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
RETURNING *;
`.trim(),
      [input.jobId, now, input.workerId],
    );

    return await this.#requiredLockedUpdate(result, input.jobId, input.workerId);
  }

  async rerunJob(input: RerunJobInput): Promise<JobRecord> {
    const originalJob = await this.#requireJobOwnedBy(input.jobId, input.userId);

    if (!isTerminalJob(originalJob)) {
      throw new JobError("job_not_terminal", "Only completed, failed, or canceled jobs can be rerun.");
    }

    const rerunIdempotencyKey = input.idempotencyKey.trim();
    if (rerunIdempotencyKey.length === 0) {
      throw new JobError("idempotency_key_required", "Rerun jobs require an idempotency key.");
    }

    return await this.submit({
      userId: originalJob.userId,
      leagueId: originalJob.leagueId,
      seasonId: originalJob.seasonId,
      kind: originalJob.kind,
      inputJson: originalJob.inputJson,
      idempotencyKey: jobRerunIdempotencyKeyFor(originalJob.id, rerunIdempotencyKey),
      maxAttempts: originalJob.maxAttempts,
      now: input.now,
    });
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    const result = await this.#client.query<JobRow>(
      "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at ASC, id ASC",
      [userId],
    );

    return result.rows.map(jobFromRow);
  }

  async fetchForUser(jobId: string, userId: string): Promise<JobRecord | null> {
    const result = await this.#client.query<JobRow>(
      "SELECT * FROM jobs WHERE id = $1 AND user_id = $2",
      [jobId, userId],
    );
    const row = firstRow(result);

    return row === undefined ? null : jobFromRow(row);
  }

  async #findByIdempotencyKey(input: SubmitJobInput): Promise<JobRecord | null> {
    const result = await this.#client.query<JobRow>(
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
  }

  async #findById(jobId: string): Promise<JobRecord | null> {
    const result = await this.#client.query<JobRow>(selectJobByIdSql, [jobId]);
    const row = firstRow(result);

    return row === undefined ? null : jobFromRow(row);
  }

  async #requireJobOwnedBy(jobId: string, userId: string): Promise<JobRecord> {
    const job = await this.#findById(jobId);
    if (job === null) {
      throw new JobError("job_not_found", "Job was not found.");
    }
    if (job.userId !== userId) {
      throw new JobError("job_owner_required", "Job belongs to another user.");
    }

    return job;
  }

  async #requireRunningLockedJob(jobId: string, workerId: string): Promise<JobRecord> {
    const job = await this.#findById(jobId);
    if (job === null) {
      throw new JobError("job_not_found", "Job was not found.");
    }
    if (job.status !== "running") {
      throw new JobError("job_not_running", "Job is not running.");
    }
    if (job.workerId !== workerId) {
      throw new JobError("job_lock_mismatch", "Job is locked by another worker.");
    }

    return job;
  }

  async #requiredLockedUpdate(
    result: PostgresQueryResult<JobRow>,
    jobId: string,
    workerId: string,
  ): Promise<JobRecord> {
    const row = firstRow(result);
    if (row !== undefined) return jobFromRow(row);

    await this.#requireRunningLockedJob(jobId, workerId);
    throw new Error("Postgres job lifecycle update did not return an updated row.");
  }

  async #requiredCompletionUpdate(
    result: PostgresQueryResult<JobRow>,
    jobId: string,
    workerId: string,
  ): Promise<JobRecord> {
    const row = firstRow(result);
    if (row !== undefined) return jobFromRow(row);

    const job = await this.#requireRunningLockedJob(jobId, workerId);
    if (job.cancellationRequestedAt !== undefined) {
      throw new JobError("job_not_claimable", "Job has requested cancellation.");
    }

    throw new Error("Postgres job completion did not return an updated row.");
  }

  async #requiredFailureUpdate(
    result: PostgresQueryResult<JobRow>,
    jobId: string,
    workerId: string,
    now: Date,
  ): Promise<JobRecord> {
    const row = firstRow(result);
    if (row !== undefined) return jobFromRow(row);

    const job = await this.#requireRunningLockedJob(jobId, workerId);
    if (job.cancellationRequestedAt !== undefined) {
      return await this.cancelJobAtRunBoundary({ jobId, workerId, now });
    }

    throw new Error("Postgres job failure update did not return an updated row.");
  }
}
