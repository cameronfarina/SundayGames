import type {
  JobQueueHealth,
  JobQueueHealthInput,
  RecordWorkerHeartbeatInput,
} from "../jobs.js";
import type { JobQueueContext } from "./types.js";

interface WorkerHealthRow {
  worker_last_seen_at: Date | string | null;
  queued_count: string;
  oldest_queued_at: Date | string | null;
}

const dateValue = (value: Date | string | null): Date | undefined =>
  value === null ? undefined : value instanceof Date ? value : new Date(value);

export const recordWorkerHeartbeat = async (
  context: JobQueueContext,
  input: RecordWorkerHeartbeatInput,
): Promise<void> => {
  const now = input.now ?? new Date();
  await context.client.query(
    `INSERT INTO platform_worker_heartbeats
       (worker_id, job_kinds_json, started_at, last_seen_at)
     VALUES ($1, $2::jsonb, $3, $3)
     ON CONFLICT (worker_id) DO UPDATE
     SET job_kinds_json = EXCLUDED.job_kinds_json,
         last_seen_at = EXCLUDED.last_seen_at`,
    [input.workerId, JSON.stringify(input.jobKinds), now],
  );
};

export const getQueueHealth = async (
  context: JobQueueContext,
  input: JobQueueHealthInput,
): Promise<JobQueueHealth> => {
  const now = input.now ?? new Date();
  const cutoff = new Date(now.getTime() - (input.staleAfterMs ?? 45_000));
  const result = await context.client.query<WorkerHealthRow>(
    `SELECT
       (SELECT MAX(last_seen_at) FROM platform_worker_heartbeats
        WHERE job_kinds_json ? $1) AS worker_last_seen_at,
       COUNT(*) FILTER (WHERE status = 'queued')::text AS queued_count,
       MIN(created_at) FILTER (WHERE status = 'queued') AS oldest_queued_at
     FROM jobs WHERE kind = $1`,
    [input.kind],
  );
  const row = result.rows[0];
  const workerLastSeenAt = dateValue(row?.worker_last_seen_at ?? null);
  return {
    workerAvailable: workerLastSeenAt !== undefined && workerLastSeenAt >= cutoff,
    workerLastSeenAt,
    queuedCount: Number(row?.queued_count ?? "0"),
    oldestQueuedAt: dateValue(row?.oldest_queued_at ?? null),
  };
};
