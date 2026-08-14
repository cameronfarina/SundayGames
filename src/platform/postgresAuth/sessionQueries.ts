import type { SessionRecord } from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, sessionFromRow } from "./mappers.js";
import type { SessionRow } from "./rows.js";

const selectSessionSql = `
SELECT sessions.id, sessions.account_id, sessions.token_hash,
       sessions.created_at, sessions.expires_at, sessions.revoked_at
FROM sessions
`.trim();

export const findSessionByTokenHash = async (
  client: PostgresQueryClient,
  tokenHash: string,
): Promise<SessionRecord | null> => {
  const result = await client.query<SessionRow>(
    `${selectSessionSql}
JOIN accounts
  ON accounts.id = sessions.account_id
 AND accounts.auth_version = sessions.auth_version
WHERE sessions.token_hash = $1
  AND accounts.status = 'active'`,
    [tokenHash],
  );
  const row = firstRow(result);
  return row === undefined ? null : sessionFromRow(row);
};

export const findSessionById = async (
  client: PostgresQueryClient,
  sessionId: string,
): Promise<SessionRecord | null> => {
  const result = await client.query<SessionRow>(
    `${selectSessionSql} WHERE sessions.id = $1`,
    [sessionId],
  );
  const row = firstRow(result);
  return row === undefined ? null : sessionFromRow(row);
};

export const revokeSession = async (
  client: PostgresQueryClient,
  sessionId: string,
  revokedAt: Date,
): Promise<SessionRecord | null> => {
  const result = await client.query<SessionRow>(
    `
UPDATE sessions
SET revoked_at = $2
WHERE id = $1
RETURNING id, account_id, token_hash, created_at, expires_at, revoked_at;
`.trim(),
    [sessionId, revokedAt],
  );
  const row = firstRow(result);
  return row === undefined ? null : sessionFromRow(row);
};
