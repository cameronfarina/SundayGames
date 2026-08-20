const missingConfiguration =
  '{"status":"migration-required","schema":"mockd-season-mock-configuration","reason":"missing-snapshot"}';
const bridgeFunction = `
CREATE OR REPLACE FUNCTION mirror_platform_snapshot_mock_sessions()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  practice_mode text;
  stored_session jsonb;
  stored_command jsonb;
  current_commands jsonb;
  existing_user_id text; existing_revision integer;
  existing_count integer; existing_configuration_missing boolean;
  stored_revision integer; stored_count integer;
  shared_count integer; command_index integer;
  next_sequence integer;
BEGIN
  SELECT mode INTO practice_mode FROM platform_practice_persistence_control WHERE singleton = true;
  IF practice_mode = 'normalized-only' AND COALESCE(NEW.snapshot_json->'mockDraftSessions', '[]'::jsonb) <> '[]'::jsonb THEN
    RAISE EXCEPTION 'Compatibility mock sessions are disabled after normalized-only cutover';
  END IF;
  IF practice_mode <> 'dual-write' THEN RETURN NEW; END IF;
  FOR stored_session IN SELECT value FROM jsonb_array_elements(
    COALESCE(NEW.snapshot_json->'mockDraftSessions', '[]'::jsonb)
  ) LOOP
    PERFORM id FROM accounts
    WHERE id = stored_session->>'userId'
    FOR UPDATE;
    stored_revision := (stored_session->>'revision')::integer;
    stored_count := jsonb_array_length(COALESCE(stored_session->'commandLog', '[]'::jsonb));
    shared_count := 0;

    SELECT user_id, revision, command_count,
      configuration_snapshot_json->>'status' = 'migration-required'
    INTO existing_user_id, existing_revision, existing_count, existing_configuration_missing
    FROM mock_sessions WHERE id = stored_session->>'id' FOR UPDATE;
    IF FOUND THEN
      IF existing_user_id <> stored_session->>'userId' THEN
        RAISE EXCEPTION 'Mock draft session owner diverged during compatibility mirroring';
      END IF;
      IF existing_revision > stored_revision THEN CONTINUE; END IF;
      IF existing_revision < stored_revision - 1 THEN
        RAISE EXCEPTION 'Mock draft revision diverged during compatibility mirroring';
      END IF;
      IF existing_revision = stored_revision THEN
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', command_id, 'idempotencyKey', idempotency_key,
          'command', command, 'revision', revision
        ) ORDER BY sequence), '[]'::jsonb)
        INTO current_commands FROM mock_session_events
        WHERE mock_session_id = stored_session->>'id'
          AND revision = existing_revision AND event_type = 'command';
        IF jsonb_array_length(current_commands) <> existing_count THEN
          RAISE EXCEPTION 'Normalized mock draft command count is inconsistent';
        END IF;
        shared_count := LEAST(existing_count, stored_count);
        IF shared_count > 0 THEN
          FOR command_index IN 0..shared_count - 1 LOOP
            stored_command := stored_session->'commandLog'->command_index;
            IF current_commands->command_index <> jsonb_build_object(
              'id', stored_command->>'id',
              'idempotencyKey', COALESCE(
                stored_command->>'idempotencyKey', stored_command->>'id'
              ),
              'command', stored_command->>'command',
              'revision', (stored_command->>'revision')::integer
            ) THEN
              RAISE EXCEPTION 'Mock draft command history diverged during compatibility mirroring';
            END IF;
          END LOOP;
        END IF;
        IF stored_count < existing_count THEN CONTINUE; END IF;
        IF stored_count = existing_count AND
            (stored_session->>'updatedAt')::timestamptz <= (
              SELECT updated_at FROM mock_sessions WHERE id = stored_session->>'id'
            ) THEN
          IF existing_configuration_missing THEN
            UPDATE mock_sessions SET configuration_snapshot_json = COALESCE(
              stored_session->'configurationSnapshot', '${missingConfiguration}'::jsonb) WHERE id = stored_session->>'id';
          END IF;
          CONTINUE;
        END IF;
      END IF;
    END IF;

    INSERT INTO mock_sessions (
      id, league_id, league_season_id, user_id, owner_id, team_id, status,
      revision, command_count, draft_mode_json, configuration_snapshot_json,
      latest_result_ref_json, started_at, completed_at, abandoned_at, created_at, updated_at
    ) VALUES (
      stored_session->>'id', stored_session->>'leagueId', stored_session->>'seasonId',
      stored_session->>'userId', stored_session->>'ownerId', stored_session->>'teamId',
      stored_session->>'status', stored_revision, stored_count, stored_session->'draftMode',
      COALESCE(stored_session->'configurationSnapshot', '${missingConfiguration}'::jsonb),
      stored_session->'latestResultRef', (stored_session->>'startedAt')::timestamptz,
      (stored_session->>'completedAt')::timestamptz, (stored_session->>'abandonedAt')::timestamptz,
      (stored_session->>'createdAt')::timestamptz, (stored_session->>'updatedAt')::timestamptz
    ) ON CONFLICT (id) DO UPDATE SET
      status = EXCLUDED.status, revision = EXCLUDED.revision,
      command_count = EXCLUDED.command_count,
      configuration_snapshot_json = CASE
        WHEN mock_sessions.configuration_snapshot_json->>'status' = 'migration-required'
          THEN EXCLUDED.configuration_snapshot_json
        ELSE mock_sessions.configuration_snapshot_json END,
      latest_result_ref_json = EXCLUDED.latest_result_ref_json,
      started_at = EXCLUDED.started_at, completed_at = EXCLUDED.completed_at,
      abandoned_at = EXCLUDED.abandoned_at, updated_at = EXCLUDED.updated_at;

    SELECT COALESCE(MAX(sequence), 0) INTO next_sequence
    FROM mock_session_events WHERE mock_session_id = stored_session->>'id';
    FOR stored_command IN
      SELECT value FROM jsonb_array_elements(
        COALESCE(stored_session->'commandLog', '[]'::jsonb)
      ) WITH ORDINALITY AS command_entry(value, ordinal)
      WHERE ordinal > shared_count
    LOOP
      next_sequence := next_sequence + 1;
      INSERT INTO mock_session_events (
        id, mock_session_id, revision, sequence, event_type,
        command_id, command, payload_json, idempotency_key, created_at
      ) VALUES (
        (stored_session->>'id') || ':legacy:' || (stored_command->>'revision') || ':' ||
          COALESCE(stored_command->>'idempotencyKey', stored_command->>'id'),
        stored_session->>'id', (stored_command->>'revision')::integer, next_sequence,
        'command', stored_command->>'id', stored_command->>'command', '{}'::jsonb,
        COALESCE(stored_command->>'idempotencyKey', stored_command->>'id'),
        (stored_command->>'createdAt')::timestamptz
      ) ON CONFLICT DO NOTHING;
    END LOOP;
    SELECT count(*) INTO existing_count FROM mock_session_events
    WHERE mock_session_id = stored_session->>'id'
      AND revision = stored_revision AND event_type = 'command';
    IF existing_count <> stored_count THEN
      RAISE EXCEPTION 'Compatibility mock draft command persistence is inconsistent';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;
`.trim();

export const practicePersistenceMigrationStatements: readonly string[] = [
  `ALTER TABLE mock_sessions ADD COLUMN IF NOT EXISTS configuration_snapshot_json jsonb NOT NULL DEFAULT '${missingConfiguration}'::jsonb;`,
  "CREATE TABLE IF NOT EXISTS platform_practice_persistence_control (singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton), mode text NOT NULL CHECK (mode IN ('dual-write', 'normalized-only')), updated_at timestamptz NOT NULL DEFAULT now());",
  "INSERT INTO platform_practice_persistence_control (singleton, mode) VALUES (true, 'dual-write') ON CONFLICT (singleton) DO NOTHING;",
  bridgeFunction,
  "DROP TRIGGER IF EXISTS platform_snapshot_mock_sessions_bridge ON platform_store_snapshots;",
  "CREATE TRIGGER platform_snapshot_mock_sessions_bridge AFTER INSERT OR UPDATE OF snapshot_json ON platform_store_snapshots FOR EACH ROW EXECUTE FUNCTION mirror_platform_snapshot_mock_sessions();",
  "UPDATE platform_store_snapshots SET snapshot_json = snapshot_json;",
];
