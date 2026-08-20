import { describe, expect, it } from "vitest";
import { JobError, hashJobInput, type JobKind, type JobStatus } from "../src/platform/jobs.js";
import {
  dispatchNextPlatformJob,
  enqueueDraftRoomExportJob,
  platformJobTypes,
  type DraftRoomExportJobPayload,
  type DraftRoomExportJobResult,
} from "../src/platform/platformJobOrchestrator.js";
import {
  PostgresJobQueue,
  claimNextJobSql,
  type PostgresTransactionalQueryClient,
} from "../src/platform/postgresJobQueue.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const now = new Date("2026-08-09T12:00:00.000Z");

interface StoredJobRow {
  id: string;
  user_id: string;
  league_id: string;
  league_season_id: string;
  kind: JobKind;
  status: JobStatus;
  idempotency_key: string;
  input_hash: string;
  input_json: unknown;
  progress_json: unknown;
  result_summary_json: unknown;
  attempt_count: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: Date | null;
  heartbeat_at: Date | null;
  lock_expires_at: Date | null;
  available_at: Date;
  started_at: Date | null;
  finished_at: Date | null;
  cancellation_requested_at: Date | null;
  sanitized_error_json: unknown;
  error_summary: string | null;
  created_at: Date;
  updated_at: Date;
}

const cloneJson = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const jsonbParameterValue = (value: unknown): unknown =>
  value === null ? null : typeof value === "string" ? JSON.parse(value) : cloneJson(value);

const cloneDate = (value: Date | null): Date | null =>
  value === null ? null : new Date(value.getTime());

const cloneRow = (row: StoredJobRow): StoredJobRow => ({
  ...row,
  input_json: cloneJson(row.input_json),
  progress_json: cloneJson(row.progress_json),
  result_summary_json: row.result_summary_json === null ? null : cloneJson(row.result_summary_json),
  sanitized_error_json: row.sanitized_error_json === null ? null : cloneJson(row.sanitized_error_json),
  locked_at: cloneDate(row.locked_at),
  heartbeat_at: cloneDate(row.heartbeat_at),
  lock_expires_at: cloneDate(row.lock_expires_at),
  available_at: new Date(row.available_at.getTime()),
  started_at: cloneDate(row.started_at),
  finished_at: cloneDate(row.finished_at),
  cancellation_requested_at: cloneDate(row.cancellation_requested_at),
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

class FakePostgresJobClient implements PostgresTransactionalQueryClient {
  readonly queries: { text: string; values: readonly unknown[]; inTransaction: boolean }[] = [];
  readonly rows = new Map<string, StoredJobRow>();
  transactionCount = 0;
  commitCount = 0;
  rollbackCount = 0;
  failNextClaim = false;
  afterNextSelectById: ((row: StoredJobRow) => void) | undefined;
  #inTransaction = false;

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    this.transactionCount += 1;
    const previousTransactionState = this.#inTransaction;
    this.#inTransaction = true;

    try {
      const result = await operation(this);
      this.commitCount += 1;
      return result;
    } catch (error) {
      this.rollbackCount += 1;
      throw error;
    } finally {
      this.#inTransaction = previousTransactionState;
    }
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values, inTransaction: this.#inTransaction });
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("DELETE FROM jobs WHERE id IN")) {
      const userId = values[0];
      const retentionLimit = values[1];
      if (typeof userId !== "string" || typeof retentionLimit !== "number") {
        throw new Error("Expected a user ID and retention limit.");
      }
      const terminalRows = [...this.rows.values()]
        .filter(row => row.user_id === userId && ["completed", "failed", "canceled"].includes(row.status))
        .sort((left, right) => {
          const createdAtOrder = right.created_at.getTime() - left.created_at.getTime();

          return createdAtOrder === 0 ? right.id.localeCompare(left.id) : createdAtOrder;
        });
      for (const row of terminalRows.slice(retentionLimit)) this.rows.delete(row.id);
      return { rows: [], rowCount: 0 };
    }

    if (normalizedSql.startsWith("INSERT INTO jobs")) {
      const row = this.#rowFromInsert(values);
      const existing = this.#findByIdempotency(
        row.user_id,
        row.league_id,
        row.league_season_id,
        row.idempotency_key,
      );

      if (existing !== undefined) return { rows: [], rowCount: 0 };

      this.rows.set(row.id, row);
      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT * FROM jobs WHERE user_id = $1 AND league_id = $2")) {
      const [userId, leagueId, seasonId, idempotencyKey] = values as readonly [string, string, string, string];
      const row = this.#findByIdempotency(userId, leagueId, seasonId, idempotencyKey);

      return { rows: row === undefined ? [] : [cloneRow(row) as TRow] };
    }

    if (normalizedSql === normalizeSql(claimNextJobSql)) {
      if (this.failNextClaim) {
        this.failNextClaim = false;
        throw new Error("claim query failed");
      }

      const [nowValue, workerId, lockExpiresAt, kinds] = values as readonly [
        Date,
        string,
        Date,
        readonly JobKind[] | null,
      ];
      const row = [...this.rows.values()]
        .filter(candidate =>
          (kinds === null || kinds.includes(candidate.kind))
          && (
            (candidate.status === "queued" && candidate.available_at.getTime() <= nowValue.getTime())
            || (
              candidate.status === "running"
              && candidate.cancellation_requested_at === null
              && candidate.lock_expires_at !== null
              && candidate.lock_expires_at.getTime() <= nowValue.getTime()
            )
          )
        )
        .sort((left, right) => {
          const createdAtOrder = left.created_at.getTime() - right.created_at.getTime();

          return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
        })[0];

      if (row === undefined) return { rows: [], rowCount: 0 };

      row.status = "running";
      row.locked_by = workerId;
      row.locked_at = nowValue;
      row.heartbeat_at = nowValue;
      row.lock_expires_at = lockExpiresAt;
      row.started_at = row.started_at ?? nowValue;
      row.updated_at = nowValue;

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql === "SELECT * FROM jobs WHERE id = $1") {
      const [jobId] = values as readonly [string];
      const row = this.rows.get(jobId);
      const rows = row === undefined ? [] : [cloneRow(row) as TRow];

      if (row !== undefined && this.afterNextSelectById !== undefined) {
        const afterNextSelectById = this.afterNextSelectById;
        this.afterNextSelectById = undefined;
        afterNextSelectById(row);
      }

      return { rows };
    }

    if (normalizedSql === "SELECT * FROM jobs WHERE id = $1 AND user_id = $2") {
      const [jobId, userId] = values as readonly [string, string];
      const row = this.rows.get(jobId);

      return {
        rows: row === undefined || row.user_id !== userId ? [] : [cloneRow(row) as TRow],
      };
    }

    if (normalizedSql === "SELECT * FROM jobs WHERE user_id = $1 ORDER BY created_at ASC, id ASC") {
      const [userId] = values as readonly [string];
      const rows = [...this.rows.values()]
        .filter(row => row.user_id === userId)
        .sort((left, right) => {
          const createdAtOrder = left.created_at.getTime() - right.created_at.getTime();

          return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
        });

      return { rows: rows.map(row => cloneRow(row) as TRow) };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET progress_json")) {
      const [jobId, progress, updatedAt, workerId] = values as readonly [string, unknown, Date, string];
      const row = this.#requiredRow(jobId);
      if (!this.#lockedBy(row, workerId)) return { rows: [], rowCount: 0 };

      row.progress_json = jsonbParameterValue(progress);
      row.heartbeat_at = updatedAt;
      row.updated_at = updatedAt;

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET heartbeat_at")) {
      const [jobId, heartbeatAt, lockExpiresAt, workerId] = values as readonly [string, Date, Date, string];
      const row = this.#requiredRow(jobId);
      if (!this.#lockedBy(row, workerId)) return { rows: [], rowCount: 0 };

      row.heartbeat_at = heartbeatAt;
      row.lock_expires_at = lockExpiresAt;
      row.updated_at = heartbeatAt;

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET status = 'completed'")) {
      const [jobId, progress, resultSummary, finishedAt, workerId] =
        values as readonly [string, unknown, unknown, Date, string];
      const row = this.#requiredRow(jobId);
      if (!this.#lockedBy(row, workerId)) return { rows: [], rowCount: 0 };
      if (row.cancellation_requested_at !== null) return { rows: [], rowCount: 0 };

      row.status = "completed";
      row.progress_json = jsonbParameterValue(progress);
      row.result_summary_json = jsonbParameterValue(resultSummary);
      row.finished_at = finishedAt;
      row.updated_at = finishedAt;
      this.#clearLock(row);

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET status = $2")) {
      const [jobId, status, attempts, sanitizedError, errorSummary, finishedAt, updatedAt, workerId] =
        values as readonly [string, JobStatus, number, unknown, string, Date | null, Date, string];
      const row = this.#requiredRow(jobId);
      if (!this.#lockedBy(row, workerId)) return { rows: [], rowCount: 0 };
      if (row.cancellation_requested_at !== null) return { rows: [], rowCount: 0 };

      row.status = status;
      row.attempt_count = attempts;
      row.sanitized_error_json = jsonbParameterValue(sanitizedError);
      row.error_summary = errorSummary;
      row.finished_at = finishedAt;
      row.updated_at = updatedAt;
      this.#clearLock(row);

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (
      normalizedSql.startsWith("UPDATE jobs SET status = 'canceled'")
      && normalizedSql.includes("locked_by = NULL")
    ) {
      const [jobId, finishedAt, workerId] = values as readonly [string, Date, string];
      const row = this.#requiredRow(jobId);
      if (!this.#lockedBy(row, workerId)) return { rows: [], rowCount: 0 };

      row.status = "canceled";
      row.finished_at = finishedAt;
      row.updated_at = finishedAt;
      this.#clearLock(row);

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET status = 'canceled'")) {
      const [jobId, canceledAt, userId] = values as readonly [string, Date, string];
      const row = this.#requiredRow(jobId);
      if (row.user_id !== userId || row.status !== "queued") return { rows: [], rowCount: 0 };

      row.status = "canceled";
      row.cancellation_requested_at = canceledAt;
      row.finished_at = canceledAt;
      row.updated_at = canceledAt;

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("UPDATE jobs SET cancellation_requested_at")) {
      const [jobId, canceledAt, userId] = values as readonly [string, Date, string];
      const row = this.#requiredRow(jobId);
      if (row.user_id !== userId || row.status !== "running") return { rows: [], rowCount: 0 };

      row.cancellation_requested_at = canceledAt;
      row.updated_at = canceledAt;

      return { rows: [cloneRow(row) as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }

  #rowFromInsert(values: readonly unknown[]): StoredJobRow {
    const [
      id,
      userId,
      leagueId,
      seasonId,
      kind,
      idempotencyKey,
      inputHash,
      inputJson,
      progressJson,
      maxAttempts,
      nowValue,
    ] = values as readonly [string, string, string, string, JobKind, string, string, unknown, unknown, number, Date];

    return {
      id,
      user_id: userId,
      league_id: leagueId,
      league_season_id: seasonId,
      kind,
      status: "queued",
      idempotency_key: idempotencyKey,
      input_hash: inputHash,
      input_json: jsonbParameterValue(inputJson),
      progress_json: jsonbParameterValue(progressJson),
      result_summary_json: null,
      attempt_count: 0,
      max_attempts: maxAttempts,
      locked_by: null,
      locked_at: null,
      heartbeat_at: null,
      lock_expires_at: null,
      available_at: nowValue,
      started_at: null,
      finished_at: null,
      cancellation_requested_at: null,
      sanitized_error_json: null,
      error_summary: null,
      created_at: nowValue,
      updated_at: nowValue,
    };
  }

  #findByIdempotency(
    userId: string,
    leagueId: string,
    seasonId: string,
    idempotencyKey: string,
  ): StoredJobRow | undefined {
    return [...this.rows.values()].find(row =>
      row.user_id === userId
      && row.league_id === leagueId
      && row.league_season_id === seasonId
      && row.idempotency_key === idempotencyKey
    );
  }

  #requiredRow(jobId: string): StoredJobRow {
    const row = this.rows.get(jobId);
    if (row === undefined) throw new Error(`Unknown job ${jobId}.`);

    return row;
  }

  #clearLock(row: StoredJobRow): void {
    row.locked_by = null;
    row.locked_at = null;
    row.heartbeat_at = null;
    row.lock_expires_at = null;
  }

  #lockedBy(row: StoredJobRow, workerId: string): boolean {
    return row.status === "running" && row.locked_by === workerId;
  }
}

describe("Postgres job queue", () => {
  it("submits jobs idempotently with season scoping and JSONB string preservation", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const inputJson = {
      iterations: 1000,
      generatedAt: "2026-08-09T12:00:00.000Z",
    };

    const firstJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson,
      idempotencyKey: "simulate-current-settings",
      now,
    });
    const duplicateJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson,
      idempotencyKey: "simulate-current-settings",
      now: new Date(now.getTime() + 1_000),
    });
    const nextSeasonJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2027",
      kind: "simulation",
      inputJson,
      idempotencyKey: "simulate-current-settings",
      now: new Date(now.getTime() + 2_000),
    });

    expect(duplicateJob).toEqual(firstJob);
    expect(nextSeasonJob.id).not.toBe(firstJob.id);
    expect(firstJob).toMatchObject({
      id: expect.stringMatching(/^job_/),
      status: "queued",
      inputJson,
      progress: { completed: 0, total: 1, message: "Queued" },
      attempts: 0,
      maxAttempts: 3,
      createdAt: now,
      updatedAt: now,
    });
    expect(firstJob.inputJson).toEqual(inputJson);
    expect(await queue.listForUser("user_cam")).toHaveLength(2);

    await expect(queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 500 },
      idempotencyKey: "simulate-current-settings",
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new JobError(
      "idempotency_conflict",
      "A job already exists for this idempotency key with different input.",
    ));
  });

  it("reruns terminal jobs idempotently with fresh queued lifecycle state", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const originalJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "simulate-original",
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    await queue.cancelJob({
      jobId: originalJob.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });
    await queue.cancelJobAtRunBoundary({
      jobId: originalJob.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      now: new Date(now.getTime() + 3_000),
    });

    const rerunAt = new Date(now.getTime() + 4_000);
    const rerunJob = await queue.rerunJob({
      jobId: originalJob.id,
      userId: "user_cam",
      idempotencyKey: "rerun-click-1",
      now: rerunAt,
    });
    const rerunAgain = await queue.rerunJob({
      jobId: originalJob.id,
      userId: "user_cam",
      idempotencyKey: "rerun-click-1",
      now: new Date(now.getTime() + 5_000),
    });

    expect(rerunJob.id).not.toBe(originalJob.id);
    expect(rerunAgain.id).toBe(rerunJob.id);
    expect(rerunJob).toMatchObject({
      userId: originalJob.userId,
      leagueId: originalJob.leagueId,
      seasonId: originalJob.seasonId,
      kind: originalJob.kind,
      status: "queued",
      inputJson: originalJob.inputJson,
      inputHash: originalJob.inputHash,
      idempotencyKey: `rerun:${originalJob.id}:rerun-click-1`,
      progress: { completed: 0, total: 1, message: "Queued" },
      attempts: 0,
      maxAttempts: originalJob.maxAttempts,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      cancellationRequestedAt: undefined,
      resultSummary: undefined,
      sanitizedError: undefined,
      createdAt: rerunAt,
      updatedAt: rerunAt,
    });
  });

  it("rejects reruns for active jobs and jobs owned by another user", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const activeJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "active-job",
      now,
    });

    await expect(queue.rerunJob({
      jobId: activeJob.id,
      userId: "user_cam",
      idempotencyKey: "rerun-active",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new JobError("job_not_terminal", "Only completed, failed, or canceled jobs can be rerun."));
    await expect(queue.rerunJob({
      jobId: activeJob.id,
      userId: "user_seth",
      idempotencyKey: "rerun-rival",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new JobError("job_owner_required", "Job belongs to another user."));
  });

  it("preserves top-level JSON strings from input and result JSONB", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: "123",
      idempotencyKey: "top-level-string",
      now,
    });

    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    const completedJob = await queue.completeJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      resultSummary: "true",
      now: new Date(now.getTime() + 2_000),
    });

    expect(job.inputJson).toBe("123");
    expect(completedJob.resultSummary).toBe("true");
    const insertQuery = client.queries.find(query => normalizeSql(query.text).startsWith("INSERT INTO jobs"));
    const completeQuery = client.queries.find(query =>
      normalizeSql(query.text).startsWith("UPDATE jobs SET status = 'completed'")
    );
    expect(insertQuery?.values[7]).toBe(JSON.stringify("123"));
    expect(completeQuery?.values[2]).toBe(JSON.stringify("true"));
  });

  it("claims the oldest eligible job with a transactional skip-locked query", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const olderJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "import",
      inputJson: { source: "espn" },
      idempotencyKey: "import-espn",
      now,
    });
    await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "simulate",
      now: new Date(now.getTime() + 1_000),
    });

    const claimedAt = new Date(now.getTime() + 2_000);
    const claimedJob = await queue.claimNextJob({
      workerId: "worker_a",
      now: claimedAt,
      lockTtlMs: 30_000,
    });

    expect(claimedJob).toMatchObject({
      id: olderJob.id,
      status: "running",
      workerId: "worker_a",
      lockedAt: claimedAt,
      heartbeatAt: claimedAt,
      lockExpiresAt: new Date(claimedAt.getTime() + 30_000),
      startedAt: claimedAt,
      updatedAt: claimedAt,
    });
    expect(client.transactionCount).toBe(3);
    const claimQuery = client.queries.find(query => normalizeSql(query.text) === normalizeSql(claimNextJobSql));
    expect(claimQuery).toMatchObject({ inTransaction: true });
    expect(claimQuery?.text).toContain("FOR UPDATE SKIP LOCKED");
  });

  it("can restrict claims by job kind", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "export",
      now,
    });
    const simulationJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "simulation",
      now: new Date(now.getTime() + 1_000),
    });

    const claimedJob = await queue.claimNextJob({
      workerId: "worker_simulations",
      kinds: ["simulation"],
      now: new Date(now.getTime() + 2_000),
    });

    expect(claimedJob).toMatchObject({ id: simulationJob.id, kind: "simulation" });
    const claimQuery = client.queries.find(query => normalizeSql(query.text) === normalizeSql(claimNextJobSql));
    expect(claimQuery?.values[3]).toEqual(["simulation"]);
  });

  it("reclaims expired running jobs but skips cancellation-requested jobs", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const expiredJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "reclaim",
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
      lockTtlMs: 1_000,
    });
    const canceledRunningJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "running-canceled",
      now: new Date(now.getTime() + 500),
    });
    await queue.claimNextJob({
      workerId: "worker_canceled",
      now: new Date(now.getTime() + 1_500),
      lockTtlMs: 1_000,
    });
    await queue.cancelJob({
      jobId: canceledRunningJob.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });

    const reclaimedAt = new Date(now.getTime() + 3_000);
    const reclaimedJob = await queue.claimNextJob({
      workerId: "worker_b",
      now: reclaimedAt,
      lockTtlMs: 5_000,
    });

    expect(reclaimedJob).toMatchObject({
      id: expiredJob.id,
      status: "running",
      workerId: "worker_b",
      lockedAt: reclaimedAt,
      startedAt: new Date(now.getTime() + 1_000),
      lockExpiresAt: new Date(reclaimedAt.getTime() + 5_000),
    });
    expect(await queue.claimNextJob({
      workerId: "worker_none",
      now: reclaimedAt,
    })).toBeNull();
  });

  it("enforces worker locks for progress, heartbeat, completion, and JSON result summaries", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "model_run",
      inputJson: { strategy: "balanced" },
      idempotencyKey: "model-run",
      now,
    });

    await expect(queue.updateProgress({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 500),
      progress: { completed: 1, total: 4, message: "Parsing inputs" },
      now: new Date(now.getTime() + 500),
    })).rejects.toThrow(new JobError("job_not_running", "Job is not running."));

    await queue.claimNextJob({ workerId: "worker_a", now: new Date(now.getTime() + 1_000) });
    await expect(queue.heartbeatJob({
      jobId: job.id,
      workerId: "worker_b",
      claimLockedAt: new Date(now.getTime() + 1_000),
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new JobError("job_lock_mismatch", "Job is locked by another worker."));

    const progressAt = new Date(now.getTime() + 3_000);
    const progressedJob = await queue.updateProgress({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      progress: { completed: 1, total: 4, message: "Parsing inputs" },
      now: progressAt,
    });
    const heartbeatAt = new Date(now.getTime() + 4_000);
    const heartbeatedJob = await queue.heartbeatJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      now: heartbeatAt,
      lockTtlMs: 20_000,
    });
    const finishedAt = new Date(now.getTime() + 5_000);
    const completedJob = await queue.completeJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      resultSummary: {
        completedAt: "2026-08-09T12:00:00.000Z",
        scenarios: 1000,
      },
      now: finishedAt,
    });

    expect(progressedJob).toMatchObject({
      progress: { completed: 1, total: 4, message: "Parsing inputs" },
      heartbeatAt: progressAt,
    });
    expect(heartbeatedJob).toMatchObject({
      heartbeatAt,
      lockExpiresAt: new Date(heartbeatAt.getTime() + 20_000),
    });
    expect(completedJob).toMatchObject({
      status: "completed",
      progress: { completed: 1, total: 1, message: "Completed" },
      resultSummary: {
        completedAt: "2026-08-09T12:00:00.000Z",
        scenarios: 1000,
      },
      finishedAt,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
    });
  });

  it("rejects stale worker lifecycle updates after a running lock changes", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "stale-worker",
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
      lockTtlMs: 1_000,
    });
    client.afterNextSelectById = row => {
      row.locked_by = "worker_b";
      row.locked_at = new Date(now.getTime() + 3_000);
      row.heartbeat_at = new Date(now.getTime() + 3_000);
      row.lock_expires_at = new Date(now.getTime() + 60_000);
      row.updated_at = new Date(now.getTime() + 3_000);
    };

    await expect(queue.completeJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      resultSummary: { completed: true },
      now: new Date(now.getTime() + 4_000),
    })).rejects.toThrow(new JobError("job_lock_mismatch", "Job is locked by another worker."));

    expect(await queue.fetchForUser(job.id, "user_cam")).toMatchObject({
      status: "running",
      workerId: "worker_b",
      resultSummary: undefined,
    });
  });

  it("does not let completion overwrite a requested cancellation", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-before-complete",
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    await queue.cancelJob({
      jobId: job.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });

    await expect(queue.completeJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      resultSummary: { completed: true },
      now: new Date(now.getTime() + 3_000),
    })).rejects.toThrow(new JobError("job_not_claimable", "Job has requested cancellation."));
    expect(await queue.fetchForUser(job.id, "user_cam")).toMatchObject({
      status: "running",
      cancellationRequestedAt: new Date(now.getTime() + 2_000),
      resultSummary: undefined,
    });
  });

  it("retries failures while attempts remain and stores sanitized errors when exhausted", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "import",
      inputJson: { source: "sleeper" },
      idempotencyKey: "retry-import",
      maxAttempts: 2,
      now,
    });

    await queue.claimNextJob({ workerId: "worker_a", now: new Date(now.getTime() + 1_000) });
    const retriedJob = await queue.failJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      error: new Error("provider token sk_live_secret leaked\nat stack frame"),
      now: new Date(now.getTime() + 2_000),
    });
    await queue.claimNextJob({ workerId: "worker_b", now: new Date(now.getTime() + 3_000) });
    const failedJob = await queue.failJob({
      jobId: job.id,
      workerId: "worker_b",
      claimLockedAt: new Date(now.getTime() + 3_000),
      error: new TypeError("another sensitive detail"),
      now: new Date(now.getTime() + 4_000),
    });

    expect(retriedJob).toMatchObject({
      status: "queued",
      attempts: 1,
      sanitizedError: {
        name: "Error",
        message: "Job failed. Check worker logs for details.",
      },
      finishedAt: undefined,
      workerId: undefined,
    });
    expect(failedJob).toMatchObject({
      status: "failed",
      attempts: 2,
      sanitizedError: {
        name: "TypeError",
        message: "Job failed. Check worker logs for details.",
      },
      finishedAt: new Date(now.getTime() + 4_000),
    });
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("sk_live_secret");
    expect(JSON.stringify(failedJob.sanitizedError)).not.toContain("sensitive detail");
  });

  it("settles canceled running jobs as canceled when the handler fails", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-failed-handler",
      maxAttempts: 2,
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    await queue.cancelJob({
      jobId: job.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });

    const canceledJob = await queue.failJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      error: new Error("handler failed after cancellation"),
      now: new Date(now.getTime() + 3_000),
    });

    expect(canceledJob).toMatchObject({
      status: "canceled",
      attempts: 0,
      finishedAt: new Date(now.getTime() + 3_000),
      sanitizedError: undefined,
      workerId: undefined,
    });
  });

  it("settles as canceled when cancellation races with failure persistence", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-failure-race",
      maxAttempts: 2,
      now,
    });
    await queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    });
    client.afterNextSelectById = row => {
      row.cancellation_requested_at = new Date(now.getTime() + 2_000);
      row.updated_at = new Date(now.getTime() + 2_000);
    };

    const canceledJob = await queue.failJob({
      jobId: job.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 1_000),
      error: new Error("handler failed while canceling"),
      now: new Date(now.getTime() + 3_000),
    });

    expect(canceledJob).toMatchObject({
      status: "canceled",
      attempts: 0,
      finishedAt: new Date(now.getTime() + 3_000),
      sanitizedError: undefined,
      workerId: undefined,
    });
  });

  it("cancels queued jobs, marks running jobs for boundary cancel, and scopes user reads", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const queuedJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "cancel-export",
      now,
    });
    const runningJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "after-cancel",
      now: new Date(now.getTime() + 1_000),
    });
    const rivalJob = await queue.submit({
      userId: "user_rival",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "rival-job",
      now: new Date(now.getTime() + 2_000),
    });

    const canceledAt = new Date(now.getTime() + 3_000);
    const canceledQueuedJob = await queue.cancelJob({
      jobId: queuedJob.id,
      userId: "user_cam",
      now: canceledAt,
    });
    await queue.claimNextJob({ workerId: "worker_a", now: new Date(now.getTime() + 4_000) });
    const requestedAt = new Date(now.getTime() + 5_000);
    const cancelRequestedJob = await queue.cancelJob({
      jobId: runningJob.id,
      userId: "user_cam",
      now: requestedAt,
    });
    const boundaryAt = new Date(now.getTime() + 6_000);
    const boundaryCanceledJob = await queue.cancelJobAtRunBoundary({
      jobId: runningJob.id,
      workerId: "worker_a",
      claimLockedAt: new Date(now.getTime() + 4_000),
      now: boundaryAt,
    });

    expect(canceledQueuedJob).toMatchObject({
      status: "canceled",
      cancellationRequestedAt: canceledAt,
      finishedAt: canceledAt,
    });
    expect(cancelRequestedJob).toMatchObject({
      status: "running",
      cancellationRequestedAt: requestedAt,
      finishedAt: undefined,
    });
    expect(boundaryCanceledJob).toMatchObject({
      status: "canceled",
      finishedAt: boundaryAt,
      workerId: undefined,
      lockExpiresAt: undefined,
    });
    await expect(queue.cancelJob({
      jobId: rivalJob.id,
      userId: "user_cam",
      now,
    })).rejects.toThrow(new JobError("job_owner_required", "Job belongs to another user."));
    expect(await queue.fetchForUser(queuedJob.id, "user_cam")).toMatchObject({ id: queuedJob.id });
    expect(await queue.fetchForUser(rivalJob.id, "user_cam")).toBeNull();
    expect((await queue.listForUser("user_cam")).map(job => job.id)).toEqual([queuedJob.id, runningJob.id]);
  });

  it("does not corrupt jobs when cancellation races with claiming or completion", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const queuedJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "cancel-claim-race",
      now,
    });
    client.afterNextSelectById = row => {
      row.status = "running";
      row.locked_by = "worker_a";
      row.locked_at = new Date(now.getTime() + 1_000);
      row.heartbeat_at = new Date(now.getTime() + 1_000);
      row.lock_expires_at = new Date(now.getTime() + 31_000);
      row.started_at = new Date(now.getTime() + 1_000);
      row.updated_at = new Date(now.getTime() + 1_000);
    };

    const cancelClaimRaceJob = await queue.cancelJob({
      jobId: queuedJob.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 2_000),
    });
    const runningJob = await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "export",
      inputJson: { format: "csv" },
      idempotencyKey: "cancel-complete-race",
      now: new Date(now.getTime() + 3_000),
    });
    await queue.claimNextJob({
      workerId: "worker_b",
      now: new Date(now.getTime() + 4_000),
    });
    client.afterNextSelectById = row => {
      row.status = "completed";
      row.progress_json = { completed: 1, total: 1, message: "Completed" };
      row.result_summary_json = { storageKey: "exports/final.csv" };
      row.locked_by = null;
      row.locked_at = null;
      row.heartbeat_at = null;
      row.lock_expires_at = null;
      row.finished_at = new Date(now.getTime() + 5_000);
      row.updated_at = new Date(now.getTime() + 5_000);
    };

    const cancelCompleteRaceJob = await queue.cancelJob({
      jobId: runningJob.id,
      userId: "user_cam",
      now: new Date(now.getTime() + 6_000),
    });

    expect(cancelClaimRaceJob).toMatchObject({
      status: "running",
      workerId: "worker_a",
      cancellationRequestedAt: new Date(now.getTime() + 2_000),
      finishedAt: undefined,
    });
    expect(cancelCompleteRaceJob).toMatchObject({
      status: "completed",
      cancellationRequestedAt: undefined,
      resultSummary: { storageKey: "exports/final.csv" },
      workerId: undefined,
    });
  });

  it("rolls back failed claim transactions", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    await queue.submit({
      userId: "user_cam",
      leagueId: "league_home",
      seasonId: "season_2026",
      kind: "simulation",
      inputJson: { iterations: 1000 },
      idempotencyKey: "claim-fails",
      now,
    });
    client.failNextClaim = true;

    await expect(queue.claimNextJob({
      workerId: "worker_a",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow("claim query failed");
    expect(client.transactionCount).toBe(2);
    expect(client.rollbackCount).toBe(1);
    expect(client.commitCount).toBe(1);
  });

  it("dispatches platform jobs through the Postgres adapter", async () => {
    const client = new FakePostgresJobClient();
    const queue = new PostgresJobQueue(client);
    const job = await enqueueDraftRoomExportJob({
      repository: queue,
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "season_2026",
      draftRoomId: "room_final",
      format: "csv",
      sourceRevision: 42,
      now,
    });
    const payload = job.inputJson as DraftRoomExportJobPayload;

    const completedJob = await dispatchNextPlatformJob({
      repository: queue,
      workerId: "worker_exports",
      now: new Date(now.getTime() + 1_000),
      handlers: {
        [platformJobTypes.draftRoomExport]: (jobPayload): DraftRoomExportJobResult => ({
          type: platformJobTypes.draftRoomExport,
          draftRoomId: jobPayload.draftRoomId,
          format: jobPayload.format,
          artifactId: "export_room_final_rev42",
          storageKey: "exports/room_final/rev42.csv",
          rowCount: 24,
        }),
      },
    });

    expect(completedJob).toMatchObject({
      id: job.id,
      status: "completed",
      inputHash: hashJobInput(payload),
      resultSummary: {
        type: platformJobTypes.draftRoomExport,
        draftRoomId: "room_final",
        format: "csv",
        artifactId: "export_room_final_rev42",
        storageKey: "exports/room_final/rev42.csv",
        rowCount: 24,
      },
      workerId: undefined,
      lockExpiresAt: undefined,
    });
  });
});
