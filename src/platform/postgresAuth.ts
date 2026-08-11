import {
  AuthError,
  type AccountCredentialRecord,
  type AccountRecord,
  type AuthRepository,
  type CreateAccountRecordInput,
  type CreateCredentialSessionRecordInput,
  type CreateSessionRecordInput,
  type PasswordReplacementResult,
  type ReplacePasswordInput,
  type SessionRecord,
} from "./auth.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";

interface AccountRow {
  id: string;
  email: string;
  password_hash: string;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface SessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
}

interface PasswordReplacementRow extends AccountRow {
  revoked_session_count: string | number;
}

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

const dateFromDb = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requiredDateFromDb = (table: string, field: string, value: Date | string): Date => {
  const date = dateFromDb(value);
  if (date === undefined) {
    throw new Error(`Postgres ${table} row has invalid ${field}.`);
  }

  return date;
};

const accountFromRow = (row: AccountRow): AccountRecord => ({
  id: row.id,
  email: row.email,
  createdAt: requiredDateFromDb("accounts", "created_at", row.created_at),
  updatedAt: requiredDateFromDb("accounts", "updated_at", row.updated_at),
});

const accountCredentialFromRow = (row: AccountRow): AccountCredentialRecord => ({
  account: accountFromRow(row),
  passwordHash: row.password_hash,
});

const sessionFromRow = (row: SessionRow): SessionRecord => ({
  id: row.id,
  accountId: row.account_id,
  tokenHash: row.token_hash,
  createdAt: requiredDateFromDb("sessions", "created_at", row.created_at),
  expiresAt: requiredDateFromDb("sessions", "expires_at", row.expires_at),
  revokedAt: dateFromDb(row.revoked_at),
});

const selectAccountSql = `
SELECT id, email, password_hash, status, created_at, updated_at
FROM accounts
`.trim();

const selectSessionSql = `
SELECT sessions.id, sessions.account_id, sessions.token_hash,
       sessions.created_at, sessions.expires_at, sessions.revoked_at
FROM sessions
`.trim();

export class PostgresAuthRepository implements AuthRepository {
  readonly #client: PostgresQueryClient;

  constructor(client: PostgresQueryClient) {
    this.#client = client;
  }

  async createAccount(input: CreateAccountRecordInput): Promise<AccountRecord> {
    const result = await this.#client.query<AccountRow>(
      `
INSERT INTO accounts (
  id,
  email,
  email_normalized,
  password_hash,
  created_at,
  updated_at
) VALUES ($1, $2, $2, $3, $4, $4)
ON CONFLICT ON CONSTRAINT accounts_email_normalized_key DO NOTHING
RETURNING id, email, password_hash, status, created_at, updated_at;
`.trim(),
      [input.id, input.email, input.passwordHash, input.now],
    );
    const row = firstRow(result);

    if (row === undefined) {
      throw new AuthError("duplicate_email", "An account with this email already exists.");
    }

    return accountFromRow(row);
  }

  async findAccountCredentialByEmail(normalizedEmail: string): Promise<AccountCredentialRecord | null> {
    const result = await this.#client.query<AccountRow>(
      `${selectAccountSql} WHERE email_normalized = $1 AND status = 'active'`,
      [normalizedEmail],
    );
    const row = firstRow(result);

    return row === undefined ? null : accountCredentialFromRow(row);
  }

  async findAccountById(accountId: string): Promise<AccountRecord | null> {
    const result = await this.#client.query<AccountRow>(
      `${selectAccountSql} WHERE id = $1 AND status = 'active'`,
      [accountId],
    );
    const row = firstRow(result);

    return row === undefined ? null : accountFromRow(row);
  }

  async createSession(input: CreateSessionRecordInput): Promise<SessionRecord> {
    const result = await this.#client.query<SessionRow>(
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
      [
        input.id,
        input.accountId,
        input.tokenHash,
        input.expiresAt,
        input.createdAt,
      ],
    );
    const row = firstRow(result);
    if (row === undefined) throw new Error("Postgres session insert did not return a row.");

    return sessionFromRow(row);
  }

  async createSessionForCredential(
    input: CreateCredentialSessionRecordInput,
  ): Promise<SessionRecord | null> {
    const result = await this.#client.query<SessionRow>(
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
  }

  async findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    const result = await this.#client.query<SessionRow>(
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
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const result = await this.#client.query<SessionRow>(
      `${selectSessionSql} WHERE sessions.id = $1`,
      [sessionId],
    );
    const row = firstRow(result);

    return row === undefined ? null : sessionFromRow(row);
  }

  async revokeSession(sessionId: string, revokedAt: Date): Promise<SessionRecord | null> {
    const result = await this.#client.query<SessionRow>(
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
  }

  async replacePasswordAndRevokeSessions(
    input: ReplacePasswordInput,
  ): Promise<PasswordReplacementResult | null> {
    const result = await this.#client.query<PasswordReplacementRow>(
      `
WITH updated_account AS (
  UPDATE accounts
  SET password_hash = $3, auth_version = auth_version + 1, updated_at = $4
  WHERE id = $1
    AND status = 'active'
    AND ($2::text IS NULL OR password_hash = $2)
  RETURNING id, email, password_hash, status, created_at, updated_at
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
    if (row === undefined) return null;
    const revokedSessionCount = Number(row.revoked_session_count);
    if (!Number.isSafeInteger(revokedSessionCount) || revokedSessionCount < 0) {
      throw new Error("Postgres password replacement returned an invalid revoked session count.");
    }

    return {
      account: accountFromRow(row),
      revokedSessionCount,
    };
  }
}
