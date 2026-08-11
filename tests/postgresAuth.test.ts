import { describe, expect, it } from "vitest";
import {
  AuthError,
  createAuthService,
  type AccountRecord,
  type SessionRecord,
} from "../src/platform/auth.js";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";
import { PostgresAuthRepository } from "../src/platform/postgresAuth.js";

const now = new Date("2026-08-09T12:00:00.000Z");

interface StoredAccountRow {
  id: string;
  email: string;
  email_normalized: string;
  password_hash: string;
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

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const normalizedSql = normalizeSql(text);

    if (normalizedSql.startsWith("INSERT INTO accounts")) {
      const [id, email, passwordHash, createdAt] = values as readonly [string, string, string, Date];
      const existing = [...this.accounts.values()]
        .find(row => row.email_normalized === email);

      if (existing !== undefined) return { rows: [], rowCount: 0 };

      const row: StoredAccountRow = {
        id,
        email,
        email_normalized: email,
        password_hash: passwordHash,
        auth_version: 1,
        display_name: null,
        status: "active",
        created_at: createdAt,
        updated_at: createdAt,
      };
      this.accounts.set(id, row);

      return { rows: [cloneAccountRow(row) as TRow], rowCount: 1 };
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

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

describe("Postgres auth repository", () => {
  it("creates normalized unique accounts and keeps raw passwords out of storage", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });

    const account = await auth.createUser({
      email: " Cam@Example.com ",
      password: "correct horse battery staple",
      now,
    });

    expect(account).toEqual({
      id: expect.stringMatching(/^acct_/),
      email: "cam@example.com",
      createdAt: now,
      updatedAt: now,
    });
    expect(expectAccount(await repository.findAccountById(account.id))).toEqual(account);
    expect((await repository.findAccountCredentialByEmail("cam@example.com"))?.account).toEqual(account);
    expect([...client.accounts.values()][0]).toMatchObject({
      email: "cam@example.com",
      email_normalized: "cam@example.com",
      password_hash: expect.stringMatching(/^scrypt\$/),
    });
    expect(JSON.stringify([...client.accounts.values()])).not.toContain("correct horse battery staple");

    await expect(auth.createUser({
      email: "CAM@example.com",
      password: "second secure password",
      now: new Date(now.getTime() + 1_000),
    })).rejects.toThrow(new AuthError("duplicate_email", "An account with this email already exists."));
  });

  it("creates hashed sessions, applies expiration, and revokes by token or id", async () => {
    const client = new FakePostgresAuthClient();
    const repository = new PostgresAuthRepository(client);
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "coach@mockd.app",
      password: "valid password",
      now,
    });

    await expect(auth.login({
      email: "coach@mockd.app",
      password: "wrong password",
      now,
    })).resolves.toBeNull();

    const login = await auth.login({
      email: " COACH@MOCKD.APP ",
      password: "valid password",
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
      password: "valid password",
      now,
    });
    const login = await auth.login({
      email: "disabled@example.com",
      password: "valid password",
      now,
      sessionTtlMs: 10_000,
    });
    if (login === null) throw new Error("Expected login.");

    const accountRow = client.accounts.get(account.id);
    if (accountRow === undefined) throw new Error("Expected account row.");
    accountRow.status = "disabled";

    await expect(auth.login({
      email: "disabled@example.com",
      password: "valid password",
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
      password: "current secure password",
      now,
    });
    const firstLogin = await auth.login({ email: account.email, password: "current secure password", now });
    const secondLogin = await auth.login({
      email: account.email,
      password: "current secure password",
      now: new Date(now.getTime() + 1),
    });
    if (firstLogin === null || secondLogin === null) throw new Error("Expected logins.");
    const changedAt = new Date(now.getTime() + 2);

    await expect(auth.changePassword({
      sessionToken: firstLogin.sessionToken,
      currentPassword: "current secure password",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now: changedAt,
    })).resolves.toMatchObject({
      account: { id: account.id, updatedAt: changedAt },
      revokedSessionCount: 2,
    });

    expect([...client.sessions.values()].every(session => session.revoked_at?.getTime() === changedAt.getTime())).toBe(true);
    expect([...client.accounts.values()][0]?.password_hash).not.toContain("replacement secure password");
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
      password: "replacement secure password",
      now: new Date(now.getTime() + 4),
    })).resolves.toMatchObject({ account: { id: account.id } });
  });
});
