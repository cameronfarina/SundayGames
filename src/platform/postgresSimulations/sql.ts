export const selectSimulationWithResultSql = `
SELECT
  r.*,
  sr.id AS result_id,
  sr.summary_json,
  sr.result_set_json,
  sr.created_at AS result_created_at
FROM simulation_runs r
LEFT JOIN simulation_results sr ON sr.simulation_run_id = r.id
`.trim();

export const selectSimulationWithoutResultSql = `
SELECT
  r.*,
  NULL::text AS result_id,
  NULL::jsonb AS summary_json,
  NULL::jsonb AS result_set_json,
  NULL::timestamptz AS result_created_at
FROM simulation_runs r
`.trim();

export const selectSimulationHistorySql = `
SELECT
  r.*,
  sr.id AS result_id,
  sr.summary_json,
  CASE
    WHEN sr.result_set_json ? 'seasonSimulation'
      THEN jsonb_set(sr.result_set_json, '{seasonSimulation,runs}', '[]'::jsonb, false)
    ELSE sr.result_set_json
  END AS result_set_json,
  sr.created_at AS result_created_at
FROM simulation_runs r
LEFT JOIN simulation_results sr ON sr.simulation_run_id = r.id
`.trim();

export const pruneTerminalRunsSql = `
WITH removable AS (
  SELECT id
  FROM simulation_runs
  WHERE user_id = $1
    AND status IN ('completed', 'failed', 'canceled')
  ORDER BY created_at ASC, id ASC
  LIMIT GREATEST(
    (SELECT COUNT(*) FROM simulation_runs WHERE user_id = $1) - $2 + 1,
    0
  )
)
DELETE FROM simulation_runs WHERE id IN (SELECT id FROM removable)
`.trim();

export const insertSimulationRunSql = `
INSERT INTO simulation_runs (
  id, league_id, league_season_id, user_id, owner_id, team_id,
  idempotency_key, input_hash, request_json, status, created_at, updated_at
)
SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'requested', $10, $10
WHERE (SELECT COUNT(*) FROM simulation_runs WHERE user_id = $4) < $11
ON CONFLICT (user_id, league_id, league_season_id, idempotency_key) DO NOTHING
RETURNING *, NULL::text AS result_id, NULL::jsonb AS summary_json,
  NULL::jsonb AS result_set_json, NULL::timestamptz AS result_created_at;
`.trim();
