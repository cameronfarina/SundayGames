import type { LeagueConnectionCredentials } from "./leagueConnections.js";
import type { LeagueConnectionCredentialCipher } from
  "./leagueConnectionCredentialEncryption.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";

const defaultBatchSize = 100;

interface CredentialBackfillRow {
  account_id: string;
  credentials_ciphertext: string | null;
  credentials_key_id: string | null;
  espn_s2: string | null;
  id: string;
  provider: string;
  provider_league_id: string;
  season: string;
  swid: string | null;
}

export interface LeagueConnectionCredentialBackfillResult {
  complete: boolean;
  examined: number;
  migrated: number;
}

const eligibleCredentialRowsSql = `
espn_s2 IS NOT NULL
OR swid IS NOT NULL
OR (
  provider = 'espn'
  AND credentials_ciphertext IS NOT NULL
  AND credentials_key_id IS DISTINCT FROM $1
)
`.trim();

const selectCredentialBackfillRowsSql = `
SELECT
  id, account_id, provider, provider_league_id, season, espn_s2, swid,
  credentials_ciphertext, credentials_key_id
FROM league_connections
WHERE ${eligibleCredentialRowsSql}
ORDER BY id
FOR UPDATE SKIP LOCKED
LIMIT $2
`.trim();

const selectCredentialBackfillCompletionSql = `
SELECT NOT EXISTS (
  SELECT 1
  FROM league_connections
  WHERE ${eligibleCredentialRowsSql}
) AS backfill_complete
`.trim();

const clearLegacyCredentialsSql = `
UPDATE league_connections
SET
  espn_s2 = NULL,
  swid = NULL,
  updated_at = $2
WHERE id = $1
`.trim();

const replaceCredentialEnvelopeSql = `
UPDATE league_connections
SET
  credentials_ciphertext = $2,
  credentials_key_id = $3,
  espn_s2 = NULL,
  swid = NULL,
  updated_at = $4
WHERE id = $1
`.trim();

const legacyCredentialsFrom = (
  row: CredentialBackfillRow,
): LeagueConnectionCredentials | undefined => {
  if (row.espn_s2 === null && row.swid === null) return undefined;
  return {
    ...(row.espn_s2 === null ? {} : { espnS2: row.espn_s2 }),
    ...(row.swid === null ? {} : { swid: row.swid }),
  };
};

export const backfillLeagueConnectionCredentials = async (
  client: PostgresTransactionalQueryClient,
  cipher: LeagueConnectionCredentialCipher,
  batchSize = defaultBatchSize,
  now: Date = new Date(),
): Promise<LeagueConnectionCredentialBackfillResult> => {
  if (!Number.isInteger(batchSize) || batchSize <= 0) {
    throw new Error("Credential backfill batch size must be a positive integer.");
  }
  const updatedAt = now.toISOString();
  return await client.transaction(async transactionClient => {
    const result = await transactionClient.query<CredentialBackfillRow>(
      selectCredentialBackfillRowsSql,
      [cipher.activeKeyId, batchSize],
    );
    if (result.rows.length === 0) {
      const completion = await transactionClient.query<{ backfill_complete: boolean }>(
        selectCredentialBackfillCompletionSql,
        [cipher.activeKeyId],
      );
      return {
        complete: completion.rows[0]?.backfill_complete === true,
        examined: 0,
        migrated: 0,
      };
    }
    let migrated = 0;
    for (const row of result.rows) {
      if (row.provider !== "espn") {
        const update = await transactionClient.query(clearLegacyCredentialsSql, [
          row.id,
          updatedAt,
        ]);
        migrated += update.rowCount ?? 0;
        continue;
      }
      const context = {
        accountId: row.account_id,
        providerLeagueId: row.provider_league_id,
        season: row.season,
      };
      const legacyCredentials = legacyCredentialsFrom(row);
      const credentials = legacyCredentials ?? (
        row.credentials_ciphertext === null || row.credentials_key_id === null
          ? undefined
          : cipher.decrypt({
              ciphertext: row.credentials_ciphertext,
              keyId: row.credentials_key_id,
            }, context)
      );
      if (credentials === undefined) {
        throw new Error("Stored ESPN credentials could not be migrated.");
      }
      const encrypted = cipher.encrypt(credentials, context);
      const update = await transactionClient.query(replaceCredentialEnvelopeSql, [
        row.id,
        encrypted.ciphertext,
        encrypted.keyId,
        updatedAt,
      ]);
      migrated += update.rowCount ?? 0;
    }
    return { complete: false, examined: result.rows.length, migrated };
  });
};
