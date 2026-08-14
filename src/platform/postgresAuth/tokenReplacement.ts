import type { AuthTokenRecord, ReplaceAuthTokenInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { authTokenFromRow, firstRow } from "./mappers.js";
import type { AuthTokenRow } from "./rows.js";

export const replaceAuthToken = async (
  client: PostgresQueryClient,
  input: ReplaceAuthTokenInput,
): Promise<AuthTokenRecord | null> => {
  const result = await client.query<AuthTokenRow>(
    `
WITH eligible_account AS (
  SELECT id, auth_version
  FROM accounts
  WHERE id = $2
    AND status = 'active'
    AND ($7::bigint IS NULL OR auth_version = $7)
),
consumed_tokens AS (
  UPDATE account_auth_tokens
  SET consumed_at = $5
  WHERE account_id IN (SELECT id FROM eligible_account)
    AND purpose = $3
    AND consumed_at IS NULL
  RETURNING id
)
INSERT INTO account_auth_tokens (
  id, account_id, purpose, token_hash, auth_version, created_at, expires_at
)
SELECT $1, eligible_account.id, $3, $4, eligible_account.auth_version, $5, $6
FROM eligible_account
CROSS JOIN (SELECT COUNT(*) FROM consumed_tokens) AS consumed
RETURNING id, account_id, purpose, token_hash, auth_version, created_at, expires_at, consumed_at;
`.trim(),
    [
      input.id,
      input.accountId,
      input.purpose,
      input.tokenHash,
      input.createdAt,
      input.expiresAt,
      input.expectedCredentialVersion ?? null,
    ],
  );
  const row = firstRow(result);
  return row === undefined ? null : authTokenFromRow(row);
};
