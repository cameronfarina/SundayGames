import { describe, expect, it } from "vitest";
import {
  AuthError,
  InMemoryAuthRepository,
  createAuthService,
  normalizeEmail,
  type AccountRecord,
  type CreateAccountRecordInput,
  type CreateCredentialSessionRecordInput,
  type LoginResult,
  type SessionRecord,
} from "../src/platform/auth.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const legacyPasswordHash = "scrypt$16384$8$1$MDEyMzQ1Njc4OWFiY2RlZg$19U3Go2tDZrZwcqamyyMiEtE0AiA5I3Cbnl1EmaIb9YIPMiiQwsl5ME7hJim9tcVF8KlOI1hg4Pc75P9hsIKbQ";

class TrackingAuthRepository extends InMemoryAuthRepository {
  createAccountStarted = false;

  override createAccount(input: CreateAccountRecordInput): AccountRecord {
    this.createAccountStarted = true;
    return super.createAccount(input);
  }
}

class PausedCredentialSessionRepository extends InMemoryAuthRepository {
  readonly sessionCreationStarted: Promise<void>;
  #markSessionCreationStarted!: () => void;
  #continueSessionCreation!: () => void;
  readonly #sessionCreationAllowed: Promise<void>;

  constructor() {
    super();
    this.sessionCreationStarted = new Promise(resolve => {
      this.#markSessionCreationStarted = resolve;
    });
    this.#sessionCreationAllowed = new Promise(resolve => {
      this.#continueSessionCreation = resolve;
    });
  }

  allowSessionCreation(): void {
    this.#continueSessionCreation();
  }

  override async createSessionForCredential(
    input: CreateCredentialSessionRecordInput,
  ): Promise<SessionRecord | null> {
    this.#markSessionCreationStarted();
    await this.#sessionCreationAllowed;

    return await super.createSessionForCredential(input);
  }
}

const expectLoginResult = (login: LoginResult | null): LoginResult => {
  expect(login).not.toBeNull();

  if (login === null) {
    throw new Error("Expected login to succeed.");
  }

  return login;
};

describe("platform auth foundation", () => {
  it("yields while deriving a password before persisting an account", async () => {
    const repository = new TrackingAuthRepository();
    const auth = createAuthService({ repository });

    const accountPromise = auth.createUser({
      email: "async-password@mockd.app",
      password: "a secure password",
      now,
    });

    expect(repository.createAccountStarted).toBe(false);
    await expect(accountPromise).resolves.toMatchObject({
      email: "async-password@mockd.app",
    });
    expect(repository.createAccountStarted).toBe(true);
  });

  it("creates a user with a normalized unique email", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });

    const account = await auth.createUser({
      email: "  Example.User+Mockd@Example.COM  ",
      password: "correct horse battery staple",
      now,
    });

    expect(account).toEqual({
      id: expect.stringMatching(/^acct_/),
      email: "example.user+mockd@example.com",
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    expect(normalizeEmail("EXAMPLE.USER+MOCKD@example.com")).toBe(account.email);
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

  it("enforces the browser password minimum at the authentication boundary", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });

    await expect(auth.createUser({
      email: "short-password@mockd.app",
      password: "short",
      now,
    })).rejects.toThrow(new AuthError(
      "invalid_password",
      "Password must be at least 6 characters.",
    ));
  });

  it("logs in with a password and returns the raw session token only in the login result", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "coach@mockd.app",
      password: "valid password phrase",
      now,
    });

    await expect(auth.login({
      email: "coach@mockd.app",
      password: "wrong password phrase",
      now,
    })).resolves.toBeNull();

    const login = expectLoginResult(await auth.login({
      email: " COACH@MOCKD.APP ",
      password: "valid password phrase",
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

  it("does not create a session when the password rotates after verification", async () => {
    const repository = new PausedCredentialSessionRepository();
    const auth = createAuthService({ repository });
    await auth.createUser({
      email: "concurrent-login@mockd.app",
      password: "current secure password",
      now,
    });
    const login = auth.login({
      email: "concurrent-login@mockd.app",
      password: "current secure password",
      now,
    });
    await repository.sessionCreationStarted;

    await expect(auth.resetPassword({
      email: "concurrent-login@mockd.app",
      newPassword: "replacement secure password",
      now: new Date(now.getTime() + 1),
    })).resolves.not.toBeNull();
    repository.allowSessionCreation();

    await expect(login).resolves.toBeNull();
    expect(repository.sessions()).toEqual([]);
  });

  it("logs in with a password hash produced by the existing scrypt format", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const account = repository.createAccount({
      id: "acct_existing",
      email: "existing@mockd.app",
      passwordHash: legacyPasswordHash,
      now,
    });

    const login = expectLoginResult(await auth.login({
      email: "existing@mockd.app",
      password: "legacy password",
      now,
    }));

    expect(login.account).toEqual(account);
  });

  it("keeps unknown-account login on the asynchronous password verification path", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });
    let loginSettled = false;
    const loginPromise = auth.login({
      email: "unknown@mockd.app",
      password: "unknown password",
      now,
    }).then(result => {
      loginSettled = true;
      return result;
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(loginSettled).toBe(false);
    await expect(loginPromise).resolves.toBeNull();
  });

  it("looks sessions up by hashed token and ignores expired sessions", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });
    const account = await auth.createUser({
      email: "session@mockd.app",
      password: "valid password phrase",
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: "session@mockd.app",
      password: "valid password phrase",
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
      password: "valid password phrase",
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: "logout@mockd.app",
      password: "valid password phrase",
      now,
    }));

    await expect(auth.logout(login.sessionToken, new Date(now.getTime() + 1))).resolves.toBe(true);
    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 2))).resolves.toBeNull();

    const secondLogin = expectLoginResult(await auth.login({
      email: "logout@mockd.app",
      password: "valid password phrase",
      now: new Date(now.getTime() + 3),
    }));

    await expect(auth.revokeSession(secondLogin.session.id, new Date(now.getTime() + 4))).resolves.toBe(true);
    await expect(auth.lookupSession(secondLogin.sessionToken, new Date(now.getTime() + 5))).resolves.toBeNull();
  });

  it("changes a signed-in account password atomically and revokes every session", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "change-password@mockd.app",
      password: "current secure password",
      now,
    });
    const firstLogin = expectLoginResult(await auth.login({
      email: account.email,
      password: "current secure password",
      now,
    }));
    const secondLogin = expectLoginResult(await auth.login({
      email: account.email,
      password: "current secure password",
      now: new Date(now.getTime() + 1),
    }));
    const changedAt = new Date(now.getTime() + 2);

    await expect(auth.changePassword({
      sessionToken: firstLogin.sessionToken,
      currentPassword: "current secure password",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now: changedAt,
    })).resolves.toEqual({
      account: { ...account, updatedAt: changedAt },
      revokedSessionCount: 2,
    });

    await expect(auth.lookupSession(firstLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(auth.lookupSession(secondLogin.sessionToken, new Date(now.getTime() + 3))).resolves.toBeNull();
    await expect(auth.login({
      email: account.email,
      password: "current secure password",
      now: new Date(now.getTime() + 4),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: account.email,
      password: "replacement secure password",
      now: new Date(now.getTime() + 4),
    })).resolves.toMatchObject({ account: { id: account.id } });
  });

  it("leaves the credential and sessions unchanged when a password change is invalid", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const account = await auth.createUser({
      email: "unchanged-password@mockd.app",
      password: "current secure password",
      now,
    });
    const login = expectLoginResult(await auth.login({
      email: account.email,
      password: "current secure password",
      now,
    }));

    await expect(auth.changePassword({
      sessionToken: login.sessionToken,
      currentPassword: "wrong current password",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now: new Date(now.getTime() + 1),
    })).rejects.toThrow(new AuthError(
      "invalid_current_password",
      "Current password is incorrect.",
    ));
    await expect(auth.changePassword({
      sessionToken: login.sessionToken,
      currentPassword: "current secure password",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "different secure password",
      now: new Date(now.getTime() + 2),
    })).rejects.toThrow(new AuthError(
      "password_confirmation_mismatch",
      "New passwords do not match.",
    ));
    await expect(auth.changePassword({
      sessionToken: login.sessionToken,
      currentPassword: "current secure password",
      newPassword: "current secure password",
      newPasswordConfirmation: "current secure password",
      now: new Date(now.getTime() + 3),
    })).rejects.toThrow(new AuthError(
      "password_unchanged",
      "Choose a password you have not already used.",
    ));

    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 4))).resolves.toMatchObject({
      account: { id: account.id },
    });
    await expect(auth.login({
      email: account.email,
      password: "current secure password",
      now: new Date(now.getTime() + 4),
    })).resolves.toMatchObject({ account: { id: account.id } });
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
