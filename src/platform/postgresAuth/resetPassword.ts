import type { PasswordReplacementResult, ResetPasswordByTokenInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, passwordReplacementFromRow } from "./mappers.js";
import type { PasswordReplacementRow } from "./rows.js";

export const resetPasswordByToken = async (
  client: PostgresQueryClient,
  input: ResetPasswordByTokenInput,
): Promise<PasswordReplacementResult | null> => {
  const result = await client.query<PasswordReplacementRow>(
    `
WITH consumed_token AS (
  UPDATE account_auth_tokens
  SET consumed_at = $3
  WHERE token_hash = $1
    AND purpose = 'password_reset'
    AND consumed_at IS NULL
    AND expires_at > $3
    AND auth_version = (
      SELECT auth_version FROM accounts WHERE id = account_auth_tokens.account_id
    )
  RETURNING account_id, auth_version
),
updated_account AS (
  UPDATE accounts
  SET password_hash = $2, auth_version = accounts.auth_version + 1, updated_at = $3
  FROM consumed_token
  WHERE accounts.id = consumed_token.account_id
    AND accounts.auth_version = consumed_token.auth_version
    AND accounts.status = 'active'
    AND accounts.email_verified_at IS NOT NULL
  RETURNING accounts.id, accounts.email, accounts.password_hash, accounts.email_verified_at,
    accounts.status, accounts.created_at, accounts.updated_at
),
revoked_sessions AS (
  UPDATE sessions
  SET revoked_at = $3
  WHERE account_id IN (SELECT id FROM updated_account)
    AND revoked_at IS NULL
  RETURNING id
)
SELECT updated_account.*,
  (SELECT COUNT(*)::text FROM revoked_sessions) AS revoked_session_count
FROM updated_account;
`.trim(),
    [input.tokenHash, input.passwordHash, input.now],
  );
  const row = firstRow(result);
  return row === undefined ? null : passwordReplacementFromRow(row, "reset");
};
