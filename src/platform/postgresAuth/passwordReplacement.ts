import type { PasswordReplacementResult, ReplacePasswordInput } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, passwordReplacementFromRow } from "./mappers.js";
import type { PasswordReplacementRow } from "./rows.js";

export const replacePasswordAndRevokeSessions = async (
  client: PostgresQueryClient,
  input: ReplacePasswordInput,
): Promise<PasswordReplacementResult | null> => {
  const result = await client.query<PasswordReplacementRow>(
    `
WITH updated_account AS (
  UPDATE accounts
  SET password_hash = $3, auth_version = auth_version + 1, updated_at = $4
  WHERE id = $1
    AND status = 'active'
    AND ($2::text IS NULL OR password_hash = $2)
  RETURNING id, email, password_hash, email_verified_at, status, created_at, updated_at
),
revoked_sessions AS (
  UPDATE sessions
  SET revoked_at = $4
  WHERE account_id IN (SELECT id FROM updated_account)
    AND revoked_at IS NULL
  RETURNING id
)
SELECT updated_account.*,
  (SELECT COUNT(*)::text FROM revoked_sessions) AS revoked_session_count
FROM updated_account;
`.trim(),
    [input.accountId, input.expectedPasswordHash ?? null, input.passwordHash, input.now],
  );
  const row = firstRow(result);
  return row === undefined ? null : passwordReplacementFromRow(row, "replacement");
};
