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
      THEN jsonb_set(
        sr.result_set_json,
        '{seasonSimulation,runs}',
        COALESCE((
          SELECT jsonb_agg(jsonb_set(
            simulation_run.value,
            '{teams}',
            COALESCE((
              SELECT jsonb_agg(jsonb_set(
                simulation_team.value,
                '{roster}',
                '[]'::jsonb,
                false
              ))
              FROM jsonb_array_elements(simulation_run.value->'teams') AS simulation_team(value)
              WHERE simulation_team.value @> '{"isUserTeam":true}'::jsonb
            ), '[]'::jsonb),
            false
          ) ORDER BY (simulation_run.value->>'runNumber')::integer)
          FROM jsonb_array_elements(
            sr.result_set_json #> '{seasonSimulation,runs}'
          ) AS simulation_run(value)
        ), '[]'::jsonb),
        false
      )
    ELSE sr.result_set_json
  END AS result_set_json,
  sr.created_at AS result_created_at
FROM simulation_runs r
LEFT JOIN simulation_results sr ON sr.simulation_run_id = r.id
`.trim();

export const pruneTerminalRunsSql = `
WITH ranked_completed AS (
  SELECT id
  FROM simulation_runs
  WHERE user_id = $1
    AND status = 'completed'
  ORDER BY completed_at DESC NULLS LAST, id DESC
  OFFSET $2
), removable AS (
  SELECT id FROM ranked_completed
  UNION ALL
  SELECT id FROM simulation_runs
  WHERE user_id = $1 AND status IN ('failed', 'canceled')
  UNION ALL
  SELECT id FROM simulation_runs
  WHERE user_id = $1 AND status = 'requested'
    AND created_at < $3::timestamptz - INTERVAL '1 hour'
)
DELETE FROM simulation_runs WHERE id IN (SELECT id FROM removable)
`.trim();

export const reconcileAbandonedSimulationRunsSql = `
DELETE FROM simulation_runs
WHERE status IN ('failed', 'canceled')
   OR (status = 'requested' AND created_at < $1::timestamptz - INTERVAL '1 hour')
`.trim();

export const insertSimulationRunSql = `
INSERT INTO simulation_runs (
  id, league_id, league_season_id, user_id, owner_id, team_id,
  idempotency_key, input_hash, request_json, status, created_at, updated_at
)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, 'requested', $10, $10)
ON CONFLICT (user_id, league_id, league_season_id, idempotency_key) DO NOTHING
RETURNING *, NULL::text AS result_id, NULL::jsonb AS summary_json,
  NULL::jsonb AS result_set_json, NULL::timestamptz AS result_created_at;
`.trim();
