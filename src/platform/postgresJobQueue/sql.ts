export const selectJobByIdSql = "SELECT * FROM jobs WHERE id = $1";

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

export const simulationRerunSql = `
INSERT INTO jobs (
  id, user_id, league_id, league_season_id, kind, status, idempotency_key,
  input_hash, input_json, progress_json, attempt_count, max_attempts,
  available_at, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8::jsonb, $9::jsonb, 0, $10, $11, $11, $11)
ON CONFLICT ON CONSTRAINT jobs_user_league_season_idempotency_key DO UPDATE
SET status = 'queued',
    progress_json = EXCLUDED.progress_json,
    attempt_count = 0,
    available_at = EXCLUDED.available_at,
    locked_by = NULL,
    locked_at = NULL,
    heartbeat_at = NULL,
    lock_expires_at = NULL,
    started_at = NULL,
    finished_at = NULL,
    cancellation_requested_at = NULL,
    result_summary_json = NULL,
    sanitized_error_json = NULL,
    error_summary = NULL,
    created_at = EXCLUDED.created_at,
    updated_at = EXCLUDED.updated_at
WHERE jobs.status IN ('completed', 'failed', 'canceled')
RETURNING jobs.*;
`.trim();
