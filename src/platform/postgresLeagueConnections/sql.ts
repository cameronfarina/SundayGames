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
  display_name = EXCLUDED.display_name,
  espn_s2 = CASE
    WHEN EXCLUDED.credentials_ciphertext IS NULL THEN league_connections.espn_s2
    ELSE NULL
  END,
  swid = CASE
    WHEN EXCLUDED.credentials_ciphertext IS NULL THEN league_connections.swid
    ELSE NULL
  END,
  credentials_ciphertext = COALESCE(
    EXCLUDED.credentials_ciphertext,
    league_connections.credentials_ciphertext
  ),
  credentials_key_id = CASE
    WHEN EXCLUDED.credentials_ciphertext IS NULL THEN league_connections.credentials_key_id
    ELSE EXCLUDED.credentials_key_id
  END,
  updated_at = EXCLUDED.updated_at
RETURNING ${connectionColumns}
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

export const selectCredentialsSql = `
SELECT
  account_id, provider_league_id, season, espn_s2, swid,
  credentials_ciphertext, credentials_key_id, xmin::text AS credential_row_version
FROM league_connections
WHERE id = $1
`.trim();

export const populateLegacyCredentialEnvelopeSql = `
UPDATE league_connections
SET
  credentials_ciphertext = $2,
  credentials_key_id = $3,
  updated_at = $5
WHERE id = $1
  AND xmin::text = $4
`.trim();

export const rotateEncryptedCredentialsSql = `
UPDATE league_connections
SET
  credentials_ciphertext = $2,
  credentials_key_id = $3,
  updated_at = $6
WHERE id = $1
  AND credentials_ciphertext IS NOT DISTINCT FROM $4
  AND credentials_key_id IS NOT DISTINCT FROM $5
  AND espn_s2 IS NULL
  AND swid IS NULL
`.trim();

export const updateConnectionStatusSql = `
UPDATE league_connections
SET
  status = $2,
  status_detail = $3,
  last_synced_at = COALESCE($4, last_synced_at),
  updated_at = $5
WHERE id = $1
`.trim();

export const linkConnectionToSeasonSql = `
UPDATE league_connections
SET league_season_id = $2, updated_at = $3
WHERE id = $1
`.trim();

export const deleteConnectionSql = `
DELETE FROM league_connections
WHERE account_id = $1 AND id = $2
`.trim();

export const upsertSnapshotSql = `
INSERT INTO league_connection_snapshots (
  connection_id, settings_json, teams_json, matchups_json, synced_at, created_at
) VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $5)
ON CONFLICT (connection_id) DO UPDATE SET
  settings_json = EXCLUDED.settings_json,
  teams_json = EXCLUDED.teams_json,
  matchups_json = EXCLUDED.matchups_json,
  synced_at = EXCLUDED.synced_at
`.trim();

export const selectSnapshotSql = `
SELECT connection_id, settings_json, teams_json, matchups_json, synced_at
FROM league_connection_snapshots
WHERE connection_id = $1
`.trim();

export const upsertPlayerDirectorySql = `
INSERT INTO provider_player_directories (provider, entries_json, fetched_at, created_at)
VALUES ($1, $2::jsonb, $3, $3)
ON CONFLICT (provider) DO UPDATE SET
  entries_json = EXCLUDED.entries_json,
  fetched_at = EXCLUDED.fetched_at
`.trim();

export const selectPlayerDirectorySql = `
SELECT provider, entries_json, fetched_at
FROM provider_player_directories
WHERE provider = $1
`.trim();
