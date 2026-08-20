const connectionColumns = `
  id, account_id, provider, provider_league_id, season, display_name,
  status, status_detail, last_synced_at, league_season_id, created_at, updated_at
`.trim();

export const upsertConnectionSql = `
INSERT INTO league_connections (
  id, account_id, provider, provider_league_id, season, display_name,
  status, status_detail, espn_s2, swid, credentials_ciphertext,
  credentials_key_id, last_synced_at, created_at, updated_at
) VALUES ($1, $2, $3, $4, $5, $6, 'pending', NULL, NULL, NULL, $7, $8, NULL, $9, $9)
ON CONFLICT (account_id, provider, provider_league_id, season) DO UPDATE SET
  display_name = CASE
    WHEN league_connections.updated_at <= EXCLUDED.updated_at THEN EXCLUDED.display_name
    ELSE league_connections.display_name
  END,
  espn_s2 = CASE
    WHEN league_connections.updated_at > EXCLUDED.updated_at THEN league_connections.espn_s2
    WHEN EXCLUDED.credentials_ciphertext IS NULL THEN league_connections.espn_s2
    ELSE NULL
  END,
  swid = CASE
    WHEN league_connections.updated_at > EXCLUDED.updated_at THEN league_connections.swid
    WHEN EXCLUDED.credentials_ciphertext IS NULL THEN league_connections.swid
    ELSE NULL
  END,
  credentials_ciphertext = CASE
    WHEN league_connections.updated_at <= EXCLUDED.updated_at
      THEN COALESCE(EXCLUDED.credentials_ciphertext, league_connections.credentials_ciphertext)
    ELSE league_connections.credentials_ciphertext
  END,
  credentials_key_id = CASE
    WHEN league_connections.updated_at > EXCLUDED.updated_at
      THEN league_connections.credentials_key_id
    WHEN EXCLUDED.credentials_ciphertext IS NULL
      THEN league_connections.credentials_key_id
    ELSE EXCLUDED.credentials_key_id
  END,
  sync_revision = CASE
    WHEN league_connections.updated_at <= EXCLUDED.updated_at
      THEN league_connections.sync_revision + 1
    ELSE league_connections.sync_revision
  END,
  updated_at = GREATEST(league_connections.updated_at, EXCLUDED.updated_at)
RETURNING ${connectionColumns}
`.trim();

export const beginConnectionSyncSql = `
UPDATE league_connections
SET sync_revision = sync_revision + 1
WHERE id = $1
RETURNING sync_revision
`.trim();

export const selectConnectionsSql = `
SELECT ${connectionColumns}
FROM league_connections
WHERE account_id = $1
ORDER BY created_at, id
`.trim();

export const selectConnectionSql = `
SELECT ${connectionColumns}
FROM league_connections
WHERE account_id = $1 AND id = $2
`.trim();

export const updateConnectionStatusSql = `
UPDATE league_connections
SET
  status = $2,
  status_detail = $3,
  last_synced_at = COALESCE($4, last_synced_at),
  updated_at = GREATEST(updated_at, $5),
  display_name = COALESCE($7, display_name)
WHERE id = $1
  AND (
    ($6::bigint IS NOT NULL AND sync_revision = $6::bigint)
    OR ($6::bigint IS NULL AND updated_at <= $5)
  )
`.trim();

export const linkConnectionToSeasonSql = `
UPDATE league_connections
SET
  league_season_id = $2,
  sync_revision = sync_revision + 1,
  updated_at = GREATEST(updated_at, $3)
WHERE id = $1
`.trim();

export const deleteConnectionSql = `
DELETE FROM league_connections
WHERE account_id = $1 AND id = $2
`.trim();

export const upsertSnapshotSql = `
INSERT INTO league_connection_snapshots (
  connection_id, settings_json, teams_json, matchups_json, synced_at, sync_revision, created_at
)
SELECT $1, $2::jsonb, $3::jsonb, $4::jsonb, $5, connection.sync_revision, $5
FROM league_connections connection
WHERE connection.id = $1 AND connection.sync_revision = $6::bigint
ON CONFLICT (connection_id) DO UPDATE SET
  settings_json = EXCLUDED.settings_json,
  teams_json = EXCLUDED.teams_json,
  matchups_json = EXCLUDED.matchups_json,
  synced_at = EXCLUDED.synced_at,
  sync_revision = EXCLUDED.sync_revision
WHERE league_connection_snapshots.sync_revision < EXCLUDED.sync_revision
  OR (
    league_connection_snapshots.sync_revision = EXCLUDED.sync_revision
    AND league_connection_snapshots.synced_at <= EXCLUDED.synced_at
  )
`.trim();

export const selectSnapshotSql = `
SELECT connection_id, settings_json, teams_json, matchups_json, synced_at, sync_revision
FROM league_connection_snapshots
WHERE connection_id = $1
`.trim();

export const upsertPlayerDirectorySql = `
INSERT INTO provider_player_directories (provider, entries_json, fetched_at, created_at)
VALUES ($1, $2::jsonb, $3, $3)
ON CONFLICT (provider) DO UPDATE SET
  entries_json = EXCLUDED.entries_json,
  fetched_at = EXCLUDED.fetched_at
WHERE provider_player_directories.fetched_at < EXCLUDED.fetched_at
`.trim();

export const selectPlayerDirectorySql = `
SELECT provider, entries_json, fetched_at
FROM provider_player_directories
WHERE provider = $1
`.trim();
