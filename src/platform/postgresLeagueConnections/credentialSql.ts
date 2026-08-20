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
  credentials_key_id = $3
WHERE id = $1
  AND xmin::text = $4
`.trim();

export const rotateEncryptedCredentialsSql = `
UPDATE league_connections
SET
  credentials_ciphertext = $2,
  credentials_key_id = $3
WHERE id = $1
  AND credentials_ciphertext IS NOT DISTINCT FROM $4
  AND credentials_key_id IS NOT DISTINCT FROM $5
  AND espn_s2 IS NULL
  AND swid IS NULL
`.trim();
