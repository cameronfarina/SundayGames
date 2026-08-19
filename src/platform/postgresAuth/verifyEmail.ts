import type { AccountRecord, VerifyEmailByTokenInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { accountFromRow, firstRow } from "./mappers.js";
import type { AccountRow } from "./rows.js";

export const verifyEmailAndSetPasswordByToken = async (
  client: PostgresQueryClient,
  input: VerifyEmailByTokenInput,
): Promise<AccountRecord | null> => {
  const result = await client.query<AccountRow>(
    `
WITH consumed_token AS (
  UPDATE account_auth_tokens
  SET consumed_at = $3
  WHERE token_hash = $1
    AND purpose = 'email_verification'
    AND consumed_at IS NULL
    AND expires_at > $3
    AND auth_version = (
      SELECT auth_version FROM accounts WHERE id = account_auth_tokens.account_id
    )
  RETURNING account_id, auth_version
)
UPDATE accounts
SET password_hash = $2,
    email_verified_at = $3,
    auth_version = accounts.auth_version + 1,
    updated_at = $3
FROM consumed_token
WHERE accounts.id = consumed_token.account_id
  AND accounts.auth_version = consumed_token.auth_version
  AND accounts.status = 'active'
  AND accounts.email_verified_at IS NULL
RETURNING id, email, display_name, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
    [input.tokenHash, input.passwordHash, input.now],
  );
  const row = firstRow(result);
  return row === undefined ? null : accountFromRow(row);
};
