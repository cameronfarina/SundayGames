export const selectUserMockDraftSessionsSql = `
SELECT ms.*,
  COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', event.command_id,
        'idempotencyKey', event.idempotency_key,
        'command', event.command,
        'revision', event.revision,
        'createdAt', event.created_at
      ) ORDER BY event.sequence
    )
    FROM mock_session_events AS event
    WHERE event.mock_session_id = ms.id
      AND event.revision = ms.revision
      AND event.event_type = 'command'
  ), '[]'::jsonb) AS command_log_json
FROM mock_sessions AS ms
WHERE ms.user_id = $1
ORDER BY ms.created_at, ms.id
`.trim();

export const upsertMockDraftSessionSql = `
INSERT INTO mock_sessions (
  id, league_id, league_season_id, user_id, owner_id, team_id, status,
  revision, command_count, draft_mode_json, configuration_snapshot_json,
  latest_result_ref_json, started_at, completed_at, abandoned_at,
  created_at, updated_at
) VALUES (
  $1, $2, $3, $4, $5, $6, $7,
  $8, $9, $10::jsonb, $11::jsonb,
  $12::jsonb, $13, $14, $15, $16, $17
)
ON CONFLICT (id) DO UPDATE SET
  status = EXCLUDED.status,
  revision = EXCLUDED.revision,
  command_count = EXCLUDED.command_count,
  latest_result_ref_json = EXCLUDED.latest_result_ref_json,
  started_at = EXCLUDED.started_at,
  completed_at = EXCLUDED.completed_at,
  abandoned_at = EXCLUDED.abandoned_at,
  updated_at = EXCLUDED.updated_at
WHERE mock_sessions.user_id = EXCLUDED.user_id;
`.trim();

export const insertMockDraftCommandSql = `
INSERT INTO mock_session_events (
  id, mock_session_id, revision, sequence, event_type,
  command_id, command, payload_json, idempotency_key, created_at
)
SELECT $1, $2, $3,
  COALESCE(MAX(sequence), 0) + 1,
  'command', $4, $5, '{}'::jsonb, $6, $7
FROM mock_session_events
WHERE mock_session_id = $2
ON CONFLICT DO NOTHING;
`.trim();
