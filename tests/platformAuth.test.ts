import { describe, expect, it } from "vitest";
import {
  AuthError,
  InMemoryAuthRepository,
  createAuthService,
  normalizeEmail,
  type LoginResult,
} from "../src/platform/auth.js";

const now = new Date("2026-08-09T12:00:00.000Z");

const expectLoginResult = (login: LoginResult | null): LoginResult => {
  expect(login).not.toBeNull();

  if (login === null) {
    throw new Error("Expected login to succeed.");
  }

  return login;
};

describe("platform auth foundation", () => {
  it("creates a user with a normalized unique email", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });

    const account = await auth.createUser({
      email: "  Cameron.Farina+Mockd@Example.COM  ",
      password: "correct horse battery staple",
      now,
    });

    expect(account).toEqual({
      id: expect.stringMatching(/^acct_/),
      email: "cameron.farina+mockd@example.com",
      createdAt: now,
      updatedAt: now,
    });
    expect(normalizeEmail("CAMERON.FARINA+MOCKD@example.com")).toBe(account.email);
  });

  it("rejects duplicate account emails case-insensitively", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });

    await auth.createUser({
      email: "team@mockd.app",
      password: "first secure password",
      now,
    });

    await expect(
      auth.createUser({
        email: " TEAM@MOCKD.APP ",
        password: "second secure password",
        now,
      }),
    ).rejects.toThrow(new AuthError("duplicate_email", "An account with this email already exists."));
  });

  it("logs in with a password and returns the raw session token only in the login result", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "coach@mockd.app",
      password: "valid password",
      now,
    });

    await expect(auth.login({ email: "coach@mockd.app", password: "wrong password", now })).resolves.toBeNull();

    const login = expectLoginResult(await auth.login({
      email: " COACH@MOCKD.APP ",
      password: "valid password",
      now,
      sessionTtlMs: 60_000,
    }));

    expect(login.account).toEqual(account);
    expect(login.session).toEqual({
      id: expect.stringMatching(/^sess_/),
      accountId: account.id,
      tokenHash: expect.any(String),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      revokedAt: undefined,
    });
    expect(login.sessionToken).toEqual(expect.any(String));
    expect(login.sessionToken).not.toBe(login.session.tokenHash);
    expect(JSON.stringify(repository.sessions())).not.toContain(login.sessionToken);
  });

  it("looks sessions up by hashed token and ignores expired sessions", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });
    const account = await auth.createUser({
      email: "session@mockd.app",
      password: "valid password",
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: "session@mockd.app",
      password: "valid password",
      now,
      sessionTtlMs: 1_000,
    }));

    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 999))).resolves.toEqual({
      account,
      session: login.session,
    });
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 1_000))).resolves.toBeNull();
  });

  it("invalidates sessions through logout and direct revocation", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });
    await auth.createUser({
      email: "logout@mockd.app",
      password: "valid password",
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: "logout@mockd.app",
      password: "valid password",
      now,
    }));

    await expect(auth.logout(login.sessionToken, new Date(now.getTime() + 1))).resolves.toBe(true);
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 2))).resolves.toBeNull();

    const secondLogin = expectLoginResult(await auth.login({
      email: "logout@mockd.app",
      password: "valid password",
      now: new Date(now.getTime() + 3),
    }));

    await expect(auth.revokeSession(secondLogin.session.id, new Date(now.getTime() + 4))).resolves.toBe(true);
    await expect(auth.lookupSession(secondLogin.sessionToken, new Date(now.getTime() + 5))).resolves.toBeNull();
  });

  it("keeps raw passwords and raw session tokens out of public records", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const rawPassword = "do not store this password";
    const account = await auth.createUser({
      email: "private@mockd.app",
      password: rawPassword,
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: "private@mockd.app",
      password: rawPassword,
      now,
    }));

    expect(repository.accounts()).toEqual([account]);
    expect(JSON.stringify(repository.accounts())).not.toContain(rawPassword);
    expect(JSON.stringify(repository.sessions())).not.toContain(login.sessionToken);
  });
});
