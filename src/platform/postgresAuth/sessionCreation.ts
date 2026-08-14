import type {
  CreateCredentialSessionRecordInput,
  CreateSessionRecordInput,
  SessionRecord,
} from "../auth.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow, sessionFromRow } from "./mappers.js";
import type { SessionRow } from "./rows.js";

export const createSession = async (
  client: PostgresQueryClient,
  input: CreateSessionRecordInput,
): Promise<SessionRecord> => {
  const result = await client.query<SessionRow>(
    `
INSERT INTO sessions (
  id,
  account_id,
  token_hash,
  auth_version,
  expires_at,
  created_at
) SELECT $1, $2, $3, accounts.auth_version, $4, $5
FROM accounts
WHERE accounts.id = $2
RETURNING id, account_id, token_hash, created_at, expires_at, revoked_at;
`.trim(),
    [input.id, input.accountId, input.tokenHash, input.expiresAt, input.createdAt],
  );
  const row = firstRow(result);
  if (row === undefined) throw new Error("Postgres session insert did not return a row.");
  return sessionFromRow(row);
};

export const createSessionForCredential = async (
  client: PostgresQueryClient,
  input: CreateCredentialSessionRecordInput,
): Promise<SessionRecord | null> => {
  const result = await client.query<SessionRow>(
    `
INSERT INTO sessions (
  id,
  account_id,
  token_hash,
  auth_version,
  expires_at,
  created_at
) SELECT $1, $2, $3, accounts.auth_version, $4, $5
FROM accounts
WHERE accounts.id = $2
  AND accounts.status = 'active'
  AND accounts.password_hash = $6
RETURNING id, account_id, token_hash, created_at, expires_at, revoked_at;
`.trim(),
    [
      input.id,
      input.accountId,
      input.tokenHash,
      input.expiresAt,
      input.createdAt,
      input.expectedPasswordHash,
    ],
  );
  const row = firstRow(result);
  return row === undefined ? null : sessionFromRow(row);
};
