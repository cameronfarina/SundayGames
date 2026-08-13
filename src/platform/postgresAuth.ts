import {
  AuthError,
  type AccountCredentialRecord,
  type AccountRecord,
  type AuthTokenRecord,
  type AuthRepository,
  type ConsumeAuthTokenInput,
  type CreateAccountRecordInput,
  type CreateOrReplacePendingAccountInput,
  type CreateCredentialSessionRecordInput,
  type CreateSessionRecordInput,
  type FindUsableAuthTokenInput,
  type PasswordReplacementResult,
  type PendingAccountRegistrationResult,
  type ReplaceAuthTokenInput,
  type ReplacePasswordInput,
  type ResetPasswordByTokenInput,
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
  email_verified_at: Date | string | null;
  status: string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface PendingAccountRow extends AccountRow {
  was_inserted: boolean;
  auth_version: string | number;
}

interface AuthTokenRow {
  id: string;
  account_id: string;
  purpose: "email_verification" | "password_reset";
  token_hash: string;
  created_at: Date | string;
  expires_at: Date | string;
  consumed_at: Date | string | null;
  auth_version: string | number;
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

const credentialVersionFromDb = (value: string | number): number => {
  const version = Number(value);
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new Error("Postgres auth row has invalid auth_version.");
  }
  return version;
};

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

const accountFromRow = (row: AccountRow): AccountRecord => {
  const emailVerifiedAt = dateFromDb(row.email_verified_at);
  return {
    id: row.id,
    email: row.email,
    ...(emailVerifiedAt === undefined ? {} : { emailVerifiedAt }),
    createdAt: requiredDateFromDb("accounts", "created_at", row.created_at),
    updatedAt: requiredDateFromDb("accounts", "updated_at", row.updated_at),
  };
};

const authTokenFromRow = (row: AuthTokenRow): AuthTokenRecord => ({
  id: row.id,
  accountId: row.account_id,
  purpose: row.purpose,
  tokenHash: row.token_hash,
  createdAt: requiredDateFromDb("account_auth_tokens", "created_at", row.created_at),
  expiresAt: requiredDateFromDb("account_auth_tokens", "expires_at", row.expires_at),
  consumedAt: dateFromDb(row.consumed_at),
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
SELECT id, email, password_hash, email_verified_at, status, created_at, updated_at
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
  email_verified_at,
  created_at,
  updated_at
) VALUES ($1, $2, $2, $3, $4, $5, $5)
ON CONFLICT ON CONSTRAINT accounts_email_normalized_key DO NOTHING
RETURNING id, email, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
      [input.id, input.email, input.passwordHash, input.emailVerifiedAt ?? input.now, input.now],
    );
    const row = firstRow(result);

    if (row === undefined) {
      throw new AuthError("duplicate_email", "An account with this email already exists.");
    }

    return accountFromRow(row);
  }

  async createOrReplacePendingAccount(
    input: CreateOrReplacePendingAccountInput,
  ): Promise<PendingAccountRegistrationResult> {
    const result = await this.#client.query<PendingAccountRow>(
      `
INSERT INTO accounts (
  id, email, email_normalized, password_hash, email_verified_at, created_at, updated_at
) VALUES ($1, $2, $2, $3, NULL, $4, $4)
ON CONFLICT ON CONSTRAINT accounts_email_normalized_key DO UPDATE
SET password_hash = EXCLUDED.password_hash,
    auth_version = accounts.auth_version + 1,
    updated_at = EXCLUDED.updated_at
WHERE accounts.email_verified_at IS NULL
RETURNING id, email, password_hash, email_verified_at, auth_version, status, created_at, updated_at,
  (xmax = 0) AS was_inserted;
`.trim(),
      [input.id, input.email, input.passwordHash, input.now],
    );
    const row = firstRow(result);
    if (row !== undefined) {
      return {
        account: accountFromRow(row),
        status: row.was_inserted ? "created" : "reissued",
        credentialVersion: credentialVersionFromDb(row.auth_version),
      };
    }
    const existing = await this.findAccountCredentialByEmail(input.email);
    if (existing === null) throw new Error("Postgres pending account upsert did not return an account.");
    return { account: existing.account, status: "verified" };
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

  async replaceAuthToken(input: ReplaceAuthTokenInput): Promise<AuthTokenRecord | null> {
    const result = await this.#client.query<AuthTokenRow>(
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
  }

  async hasUsableAuthToken(input: FindUsableAuthTokenInput): Promise<boolean> {
    const result = await this.#client.query<{ usable: boolean }>(
      `
SELECT TRUE AS usable
FROM account_auth_tokens
JOIN accounts ON accounts.id = account_auth_tokens.account_id
  AND accounts.auth_version = account_auth_tokens.auth_version
WHERE account_auth_tokens.token_hash = $1
  AND account_auth_tokens.purpose = $2
  AND account_auth_tokens.consumed_at IS NULL
  AND account_auth_tokens.expires_at > $3
LIMIT 1;
`.trim(),
      [input.tokenHash, input.purpose, input.now],
    );

    return firstRow(result)?.usable === true;
  }

  async verifyEmailByToken(input: ConsumeAuthTokenInput): Promise<AccountRecord | null> {
    const result = await this.#client.query<AccountRow>(
      `
WITH consumed_token AS (
  UPDATE account_auth_tokens
  SET consumed_at = $2
  WHERE token_hash = $1
    AND purpose = 'email_verification'
    AND consumed_at IS NULL
    AND expires_at > $2
    AND auth_version = (
      SELECT auth_version FROM accounts WHERE id = account_auth_tokens.account_id
    )
  RETURNING account_id, auth_version
)
UPDATE accounts
SET email_verified_at = $2, updated_at = $2
FROM consumed_token
WHERE accounts.id = consumed_token.account_id
  AND accounts.auth_version = consumed_token.auth_version
  AND accounts.status = 'active'
  AND accounts.email_verified_at IS NULL
RETURNING id, email, password_hash, email_verified_at, status, created_at, updated_at;
`.trim(),
      [input.tokenHash, input.now],
    );
    const row = firstRow(result);
    return row === undefined ? null : accountFromRow(row);
  }

  async resetPasswordByToken(input: ResetPasswordByTokenInput): Promise<PasswordReplacementResult | null> {
    const result = await this.#client.query<PasswordReplacementRow>(
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
    if (row === undefined) return null;
    const revokedSessionCount = Number(row.revoked_session_count);
    if (!Number.isSafeInteger(revokedSessionCount) || revokedSessionCount < 0) {
      throw new Error("Postgres password reset returned an invalid revoked session count.");
    }
    return { account: accountFromRow(row), revokedSessionCount };
  }
}
