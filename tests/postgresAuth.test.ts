import { describe, expect, it } from "vitest";
import {
  AuthError,
  CapturingAuthMailSender,
  createAuthService,
  type AccountRecord,
  type PendingAccountRegistrationResult,
  type SessionRecord,
} from "../src/platform/auth.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { PostgresAuthRepository } from "../src/platform/postgresAuth.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const credentialVersionOf = (registration: PendingAccountRegistrationResult): number => {
  if (registration.status !== "created") throw new Error("Expected a new pending account registration.");
  return registration.credentialVersion;
};

interface StoredAccountRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
  email_verified_at: Date | null;
  auth_version: number;
  display_name: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

interface StoredSessionRow {
  id: string;
  account_id: string;
  token_hash: string;
  auth_version: number;
  expires_at: Date;
  revoked_at: Date | null;
  last_used_at: Date | null;
  created_at: Date;
}

interface StoredAuthTokenRow {
  id: string;
  account_id: string;
  purpose: "email_verification" | "password_reset";
  token_hash: string;
  auth_version: number;
  created_at: Date;
  expires_at: Date;
  consumed_at: Date | null;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

const cloneDate = (value: Date | null): Date | null =>
  value === null ? null : new Date(value.getTime());

const cloneAccountRow = (row: StoredAccountRow): StoredAccountRow => ({
  ...row,
  created_at: new Date(row.created_at.getTime()),
  updated_at: new Date(row.updated_at.getTime()),
});

const cloneSessionRow = (row: StoredSessionRow): StoredSessionRow => ({
  ...row,
  expires_at: new Date(row.expires_at.getTime()),
  revoked_at: cloneDate(row.revoked_at),
  last_used_at: cloneDate(row.last_used_at),
  created_at: new Date(row.created_at.getTime()),
});

const expectAccount = (account: AccountRecord | null): AccountRecord => {
  expect(account).not.toBeNull();
  if (account === null) throw new Error("Expected account.");

  return account;
};

const expectSession = (session: SessionRecord | null): SessionRecord => {
  expect(session).not.toBeNull();
  if (session === null) throw new Error("Expected session.");

  return session;
};

class FakePostgresAuthClient implements PostgresQueryClient {
  readonly accounts = new Map<string, StoredAccountRow>();
  readonly sessions = new Map<string, StoredSessionRow>();
  readonly authTokens = new Map<string, StoredAuthTokenRow>();

  async transaction<TResult>(
    operation: (client: PostgresQueryClient) => Promise<TResult>,
  ): Promise<TResult> {
    return await operation(this);
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("INSERT INTO accounts")) {
      if (values.length === 4) {
        const [id, email, passwordHash, createdAt] = values as readonly [string, string, string, Date];
        const existing = [...this.accounts.values()].find(row => row.email_normalized === email);
        if (existing !== undefined) return { rows: [], rowCount: 0 };
        const pending: StoredAccountRow = {
          id,
          email,
          email_normalized: email,
          password_hash: passwordHash,
          email_verified_at: null,
          auth_version: 1,
          display_name: null,
          status: "active",
          created_at: createdAt,
          updated_at: createdAt,
        };
        this.accounts.set(id, pending);
        return { rows: [cloneAccountRow(pending) as TRow], rowCount: 1 };
      }
      const [id, email, passwordHash, emailVerifiedAt, createdAt] = values as readonly [
        string,
        string,
        string,
        Date,
        Date,
      ];
      const existing = [...this.accounts.values()]
        .find(row => row.email_normalized === email);

      if (existing !== undefined) return { rows: [], rowCount: 0 };

      const row: StoredAccountRow = {
        id,
        email,
        email_normalized: email,
        password_hash: passwordHash,
        email_verified_at: emailVerifiedAt,
        auth_version: 1,
        display_name: null,
        status: "active",
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.accounts.set(id, row);

      return { rows: [cloneAccountRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("WITH eligible_account AS")) {
      const [id, accountId, purpose, tokenHash, createdAt, expiresAt, expectedCredentialVersion] = values as readonly [
        string,
        string,
        StoredAuthTokenRow["purpose"],
        string,
        Date,
        Date,
        number | null,
      ];
      const account = this.accounts.get(accountId);
      if (
        account === undefined ||
        account.status !== "active" ||
        (expectedCredentialVersion !== null && account.auth_version !== expectedCredentialVersion)
      ) {
        return { rows: [], rowCount: 0 };
      }
      for (const token of this.authTokens.values()) {
        if (token.account_id === accountId && token.purpose === purpose && token.consumed_at === null) {
          token.consumed_at = createdAt;
        }
      }
      const token: StoredAuthTokenRow = {
        id,
        account_id: accountId,
        purpose,
        token_hash: tokenHash,
        auth_version: account.auth_version,
        created_at: createdAt,
        expires_at: expiresAt,
        consumed_at: null,
      };
      this.authTokens.set(tokenHash, token);
      return { rows: [{ ...token } as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("SELECT TRUE AS usable FROM account_auth_tokens")) {
      const [tokenHash, purpose, checkedAt] = values as readonly [
        string,
        StoredAuthTokenRow["purpose"],
        Date,
      ];
      const token = this.authTokens.get(tokenHash);
      const usable = token !== undefined &&
        this.accounts.get(token.account_id)?.auth_version === token.auth_version &&
        token.purpose === purpose &&
        token.consumed_at === null &&
        token.expires_at > checkedAt;

      return { rows: usable ? [{ usable: true } as TRow] : [], rowCount: usable ? 1 : 0 };
    }

    if (normalizedSql.startsWith("WITH consumed_token AS") && normalizedSql.includes("email_verification")) {
      const [tokenHash, passwordHash, verifiedAt] = values as readonly [string, string, Date];
      const token = this.authTokens.get(tokenHash);
      if (token === undefined || token.consumed_at !== null || token.expires_at <= verifiedAt) {
        return { rows: [], rowCount: 0 };
      }
      const account = this.accounts.get(token.account_id);
      if (
        account === undefined ||
        account.email_verified_at !== null ||
        account.auth_version !== token.auth_version
      ) return { rows: [], rowCount: 0 };
      token.consumed_at = verifiedAt;
      account.password_hash = passwordHash;
      account.email_verified_at = verifiedAt;
      account.auth_version += 1;
      account.updated_at = verifiedAt;
      return { rows: [cloneAccountRow(account) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("WITH consumed_token AS") && normalizedSql.includes("password_reset")) {
      const [tokenHash, passwordHash, resetAt] = values as readonly [string, string, Date];
      const token = this.authTokens.get(tokenHash);
      if (token === undefined || token.consumed_at !== null || token.expires_at <= resetAt) {
        return { rows: [], rowCount: 0 };
      }
      const account = this.accounts.get(token.account_id);
      if (
        account === undefined ||
        account.email_verified_at === null ||
        account.auth_version !== token.auth_version
      ) return { rows: [], rowCount: 0 };
      token.consumed_at = resetAt;
      account.password_hash = passwordHash;
      account.auth_version += 1;
      account.updated_at = resetAt;
      let revokedSessionCount = 0;
      for (const session of this.sessions.values()) {
        if (session.account_id === account.id && session.revoked_at === null) {
          session.revoked_at = resetAt;
          revokedSessionCount += 1;
        }
      }
      return {
        rows: [{ ...cloneAccountRow(account), revoked_session_count: String(revokedSessionCount) } as TRow],
        rowCount: 1,
      };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE email_normalized = $1")) {
      const [email] = values as readonly [string];
      const activeOnly = normalizedSql.includes("status = 'active'");
      const row = [...this.accounts.values()]
        .find(account => account.email_normalized === email && (!activeOnly || account.status === "active"));

      return { rows: row === undefined ? [] : [cloneAccountRow(row) as TRow] };
    }

    if (normalizedSql.includes("FROM accounts") && normalizedSql.includes("WHERE id = $1")) {
      const [accountId] = values as readonly [string];
      const row = this.accounts.get(accountId);
      if (normalizedSql.includes("status = 'active'") && row?.status !== "active") {
        return { rows: [] };
      }

      return { rows: row === undefined ? [] : [cloneAccountRow(row) as TRow] };
    }

    if (normalizedSql.startsWith("INSERT INTO sessions")) {
      const [id, accountId, tokenHash, expiresAt, createdAt, expectedPasswordHash] = values as readonly [
        string,
        string,
        string,
        Date,
        Date,
        string | undefined,
      ];
      const account = this.accounts.get(accountId);
      if (
        account === undefined ||
        (expectedPasswordHash !== undefined && (
          account.status !== "active" || account.password_hash !== expectedPasswordHash
        ))
      ) {
        return { rows: [], rowCount: 0 };
      }
      const row: StoredSessionRow = {
        id,
        account_id: accountId,
        token_hash: tokenHash,
        auth_version: account.auth_version,
        expires_at: expiresAt,
        revoked_at: null,
        last_used_at: null,
        created_at: createdAt,
      };
      this.sessions.set(id, row);

      return { rows: [cloneSessionRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.token_hash = $1")) {
      const [tokenHash] = values as readonly [string];
      const row = [...this.sessions.values()].find(session => {
        if (session.token_hash !== tokenHash) return false;
        const account = this.accounts.get(session.account_id);

        return account?.status === "active" && account.auth_version === session.auth_version;
      });

      return { rows: row === undefined ? [] : [cloneSessionRow(row) as TRow] };
    }

    if (normalizedSql.includes("FROM sessions") && normalizedSql.includes("WHERE sessions.id = $1")) {
      const [sessionId] = values as readonly [string];
      const row = this.sessions.get(sessionId);

      return { rows: row === undefined ? [] : [cloneSessionRow(row) as TRow] };
    }

    if (normalizedSql.startsWith("UPDATE sessions SET revoked_at")) {
      const [sessionId, revokedAt] = values as readonly [string, Date];
      const row = this.sessions.get(sessionId);
      if (row === undefined) return { rows: [], rowCount: 0 };

      row.revoked_at = revokedAt;

      return { rows: [cloneSessionRow(row) as TRow], rowCount: 1 };
    }

    if (normalizedSql.startsWith("WITH updated_account AS")) {
      const [accountId, expectedPasswordHash, passwordHash, updatedAt] = values as readonly [
        string,
        string | null,
        string,
        Date,
      ];
      const row = this.accounts.get(accountId);
      if (
        row === undefined ||
        row.status !== "active" ||
        (expectedPasswordHash !== null && row.password_hash !== expectedPasswordHash)
      ) {
        return { rows: [], rowCount: 0 };
      }

      row.password_hash = passwordHash;
      row.auth_version += 1;
      row.updated_at = updatedAt;
      let revokedSessionCount = 0;
      for (const session of this.sessions.values()) {
        if (session.account_id === accountId && session.revoked_at === null) {
          session.revoked_at = updatedAt;
          revokedSessionCount += 1;
        }
      }

      return {
        rows: [{ ...cloneAccountRow(row), revoked_session_count: String(revokedSessionCount) } as TRow],
        rowCount: 1,
      };
    }

    if (normalizedSql.startsWith("UPDATE accounts SET display_name")) {
      const [accountId, displayName, updatedAt] = values as readonly [string, string | null, Date];
      const row = this.accounts.get(accountId);
      if (row === undefined || row.status !== "active") return { rows: [], rowCount: 0 };
      row.display_name = displayName;
      row.updated_at = updatedAt;
      return { rows: [cloneAccountRow(row) as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

describe("Postgres auth repository", () => {
  it("round-trips a display name through the accounts row", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "display@example.com",
      password: "valid password phrase1!",
      now,
    });
    const savedAt = new Date(now.getTime() + 1);

    await expect(repository.replaceDisplayName({
      accountId: account.id,
      displayName: "Cam Farina",
      now: savedAt,
    })).resolves.toMatchObject({ displayName: "Cam Farina", updatedAt: savedAt });

    expect(client.accounts.get(account.id)?.display_name).toBe("Cam Farina");
    await expect(repository.findAccountById(account.id))
      .resolves.toMatchObject({ displayName: "Cam Farina" });
  });

  it("writes a null display name when the name is cleared", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "display-clear@example.com",
      password: "valid password phrase1!",
      now,
    });
    await repository.replaceDisplayName({
      accountId: account.id,
      displayName: "Cam Farina",
      now: new Date(now.getTime() + 1),
    });

    const cleared = await repository.replaceDisplayName({
      accountId: account.id,
      displayName: undefined,
      now: new Date(now.getTime() + 2),
    });

    expect(cleared?.displayName).toBeUndefined();
    expect(client.accounts.get(account.id)?.display_name).toBeNull();
  });

  it("reports no account when the display name target is missing", async () => {
    const repository = new PostgresAuthRepository(new FakePostgresAuthClient());

    await expect(repository.replaceDisplayName({
      accountId: "account-that-never-existed",
      displayName: "Cam Farina",
      now,
    })).resolves.toBeNull();
  });

  it("persists pending signup and single-use recovery tokens as hashes", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    await auth.createUser({ email: "owner@example.com", now });
    const firstMessage = mailSender.messages[0];
    expect(firstMessage).toBeDefined();
    const firstToken = new URL(firstMessage?.actionUrl ?? "https://invalid.local").searchParams.get("token") ?? "";
    expect(firstToken).not.toBe("");
    expect(JSON.stringify([...client.authTokens.values()])).not.toContain(firstToken);

    await expect(auth.createUser({
      email: "OWNER@example.com",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new AuthError("duplicate_email", "An account with this email already exists."));
    expect(mailSender.messages).toHaveLength(1);
    await expect(auth.verifyEmail({
      token: firstToken,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now: new Date(now.getTime() + 2_000),
    }))
      .resolves.toMatchObject({ emailVerifiedAt: new Date(now.getTime() + 2_000) });
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker first password1!",
      now: new Date(now.getTime() + 2_001),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker last password1!",
      now: new Date(now.getTime() + 2_001),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "mailbox proven password1!",
      now: new Date(now.getTime() + 2_001),
    })).resolves.not.toBeNull();

    await auth.requestPasswordReset({ email: "owner@example.com", now: new Date(now.getTime() + 3_000) });
    const resetMessage = mailSender.messages[1];
    const resetToken = new URL(resetMessage?.actionUrl ?? "https://invalid.local").searchParams.get("token") ?? "";
    await expect(auth.resetPasswordWithToken({
      token: resetToken,
      newPassword: "final secure password1!",
      newPasswordConfirmation: "final secure password1!",
      now: new Date(now.getTime() + 4_000),
    })).resolves.toMatchObject({ account: { email: "owner@example.com" } });
    await expect(auth.resetPasswordWithToken({
      token: resetToken,
      newPassword: "another secure password1!",
      newPasswordConfirmation: "another secure password1!",
      now: new Date(now.getTime() + 5_000),
    })).rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
  });

  it("keeps the first pending account unchanged after a duplicate create", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const initial = await repository.createPendingAccount({
      id: "acct_owner",
      email: "owner@example.com",
      passwordHash: "attacker hash",
      now,
    });
    await repository.replaceAuthToken({
      id: "token_initial",
      accountId: initial.account.id,
      purpose: "email_verification",
      tokenHash: "initial token hash",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      expectedCredentialVersion: credentialVersionOf(initial),
    });

    const duplicate = await repository.createPendingAccount({
      id: "acct_stale",
      email: "owner@example.com",
      passwordHash: "stale attacker hash",
      now: new Date(now.getTime() + 1_000),
    });

    expect(duplicate).toEqual({ account: initial.account, status: "existing" });
    await expect(repository.verifyEmailAndSetPasswordByToken({
      tokenHash: "initial token hash",
      passwordHash: "mailbox proven hash",
      now: new Date(now.getTime() + 2_000),
    })).resolves.not.toBeNull();
    await expect(repository.findAccountCredentialByEmail("owner@example.com"))
      .resolves.toMatchObject({ passwordHash: "mailbox proven hash" });
  });

  it("creates normalized unique accounts and keeps raw passwords out of storage", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });

    const account = await auth.createUser({
      email: " Owner11@Example.com ",
      password: "correct horse battery staple1!",
      now,
    });

    expect(account).toEqual({
      id: expect.stringMatching(/^acct_/),
      email: "owner11@example.com",
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(expectAccount(await repository.findAccountById(account.id))).toEqual(account);
    expect((await repository.findAccountCredentialByEmail("owner11@example.com"))?.account).toEqual(account);
    expect([...client.accounts.values()][0]).toMatchObject({
      email: "owner11@example.com",
      email_normalized: "owner11@example.com",
      email_verified_at: now,
      password_hash: expect.stringMatching(/^scrypt\$/),
    });
    expect(JSON.stringify([...client.accounts.values()])).not.toContain("correct horse battery staple1!");

    await expect(auth.createUser({
      email: "OWNER11@example.com",
      password: "second secure password1!",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new AuthError("duplicate_email", "An account with this email already exists."));
  });

  it("creates hashed sessions, applies expiration, and revokes by token or id", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "coach@mockd.app",
      password: "valid password phrase1!",
      now,
    });

    await expect(auth.login({
      email: "coach@mockd.app",
      password: "wrong password",
      now,
    })).resolves.toBeNull();

    const login = await auth.login({
      email: " COACH@MOCKD.APP ",
      password: "valid password phrase1!",
      now,
      sessionTtlMs: 1_000,
    });
    expect(login).not.toBeNull();
    if (login === null) throw new Error("Expected login.");

    expect(login.account).toEqual(account);
    expect(login.session).toEqual({
      id: expect.stringMatching(/^sess_/),
      accountId: account.id,
      tokenHash: expect.any(String),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 1_000),
      revokedAt: undefined,
    });
    expect(JSON.stringify([...client.sessions.values()])).not.toContain(login.sessionToken);
    expect(expectSession(await repository.findSessionById(login.session.id))).toEqual(login.session);

    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 999))).resolves.toEqual({
      account,
      session: login.session,
    });
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 1_000))).resolves.toBeNull();

    const revokedAt = new Date(now.getTime() + 1_001);
    await expect(auth.logout(login.sessionToken, revokedAt)).resolves.toBe(true);
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 1_002))).resolves.toBeNull();
    expect(expectSession(await repository.findSessionById(login.session.id))).toMatchObject({
      id: login.session.id,
      revokedAt,
    });

    await expect(auth.revokeSession("missing-session", new Date(now.getTime() + 1_003))).resolves.toBe(false);
  });

  it("does not authenticate disabled accounts or keep their existing sessions valid", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "disabled@example.com",
      password: "valid password phrase1!",
      now,
    });
    const login = await auth.login({
      email: "disabled@example.com",
      password: "valid password phrase1!",
      now,
      sessionTtlMs: 10_000,
    });
    if (login === null) throw new Error("Expected login.");

    const accountRow = client.accounts.get(account.id);
    if (accountRow === undefined) throw new Error("Expected account row.");
    accountRow.status = "disabled";

    await expect(auth.login({
      email: "disabled@example.com",
      password: "valid password phrase1!",
      now: new Date(now.getTime() + 1),
    })).resolves.toBeNull();
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 2))).resolves.toBeNull();
    await expect(repository.findAccountById(account.id)).resolves.toBeNull();
  });

  it("changes the password and revokes all account sessions in one repository statement", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "postgres-password@example.com",
      password: "current secure password1!",
      now,
    });
    const firstLogin = await auth.login({ email: account.email, password: "current secure password1!", now });
    const secondLogin = await auth.login({
      email: account.email,
      password: "current secure password1!",
      now: new Date(now.getTime() + 1),
    });
    if (firstLogin === null || secondLogin === null) throw new Error("Expected logins.");
    const changedAt = new Date(now.getTime() + 2);

    await expect(auth.changePassword({
      sessionToken: firstLogin.sessionToken,
      currentPassword: "current secure password1!",
      newPassword: "replacement secure password1!",
      newPasswordConfirmation: "replacement secure password1!",
      now: changedAt,
    })).resolves.toMatchObject({
      account: { id: account.id, updatedAt: changedAt },
      revokedSessionCount: 2,
    });

    expect([...client.sessions.values()].every(session => session.revoked_at?.getTime() === changedAt.getTime())).toBe(true);
    expect([...client.accounts.values()][0]?.password_hash).not.toContain("replacement secure password1!");
    client.sessions.set("sess_stale_race", {
      id: "sess_stale_race",
      account_id: account.id,
      token_hash: "stale-race-token-hash",
      auth_version: 1,
      expires_at: new Date(now.getTime() + 60_000),
      revoked_at: null,
      last_used_at: null,
      created_at: changedAt,
    });
    await expect(repository.findSessionByTokenHash("stale-race-token-hash")).resolves.toBeNull();
    await expect(auth.lookupSession(firstLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(auth.lookupSession(secondLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(auth.login({
      email: account.email,
      password: "replacement secure password1!",
      now: new Date(now.getTime() + 4),
    })).resolves.toMatchObject({ account: { id: account.id } });
  });
});
