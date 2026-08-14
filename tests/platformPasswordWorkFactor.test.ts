import { describe, expect, it } from "vitest";
import {
  AuthError,
  InMemoryAuthRepository,
  createAuthService,
  hashSessionToken,
  hashPassword,
  passwordHashNeedsRehash,
  verifyPassword,
  type AccountCredentialRecord,
  type UpgradePasswordHashInput,
} from "../src/platform/auth.js";

const now = new Date("2026-08-14T12:00:00.000Z");
const legacyPasswordHash = "scrypt$16384$8$1$MDEyMzQ1Njc4OWFiY2RlZg$19U3Go2tDZrZwcqamyyMiEtE0AiA5I3Cbnl1EmaIb9YIPMiiQwsl5ME7hJim9tcVF8KlOI1hg4Pc75P9hsIKbQ";

class PausedPasswordUpgradeRepository extends InMemoryAuthRepository {
  readonly upgradeStarted: Promise<void>;
  #markUpgradeStarted!: () => void;
  #continueUpgrade!: () => void;
  readonly #upgradeAllowed: Promise<void>;

  constructor() {
    super();
    this.upgradeStarted = new Promise(resolve => { this.#markUpgradeStarted = resolve; });
    this.#upgradeAllowed = new Promise(resolve => { this.#continueUpgrade = resolve; });
  }

  allowUpgrade(): void {
    this.#continueUpgrade();
  }

  override async upgradePasswordHash(
    input: UpgradePasswordHashInput,
  ): Promise<AccountCredentialRecord | null> {
    this.#markUpgradeStarted();
    await this.#upgradeAllowed;
    return super.upgradePasswordHash(input);
  }
}

describe("password work-factor policy", () => {
  it("creates OWASP-equivalent scrypt hashes", () => {
    const passwordHash = hashPassword("correct horse battery staple");

    expect(passwordHash).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(verifyPassword("correct horse battery staple", passwordHash)).toBe(true);
    expect(passwordHashNeedsRehash(passwordHash)).toBe(false);
  });

  it("verifies legacy hashes and marks them for replacement", () => {
    expect(verifyPassword("legacy password", legacyPasswordHash)).toBe(true);
    expect(verifyPassword("incorrect password", legacyPasswordHash)).toBe(false);
    expect(passwordHashNeedsRehash(legacyPasswordHash)).toBe(true);
  });

  it("rejects unsupported work factors without deriving attacker-selected parameters", () => {
    const unsupportedHash = legacyPasswordHash.replace("$16384$8$1$", "$1048576$8$1$");

    expect(verifyPassword("legacy password", unsupportedHash)).toBe(false);
    expect(passwordHashNeedsRehash(unsupportedHash)).toBe(true);
  });

  it("rejects passwords over 1024 UTF-8 bytes before hashing", () => {
    expect(() => hashPassword("a".repeat(1_024))).not.toThrow();
    expect(() => hashPassword(`${"a".repeat(1_023)}é`)).toThrow(new AuthError(
      "invalid_password",
      "Password must be no more than 1024 UTF-8 bytes.",
    ));
  });

  it("rejects oversized login input with a typed auth error", async () => {
    const auth = createAuthService({ repository: new InMemoryAuthRepository() });

    await expect(auth.login({
      email: "missing@example.com",
      password: "a".repeat(1_025),
      now,
    })).rejects.toThrow(new AuthError(
      "invalid_password",
      "Password must be no more than 1024 UTF-8 bytes.",
    ));
  });

  it("replaces a legacy hash before creating a successful login session", async () => {
    const repository = new InMemoryAuthRepository();
    repository.createAccount({
      id: "acct_legacy",
      email: "legacy@example.com",
      passwordHash: legacyPasswordHash,
      now,
    });
    repository.createSession({
      id: "sess_existing",
      accountId: "acct_legacy",
      tokenHash: hashSessionToken("existing session token"),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
    });
    const auth = createAuthService({ repository });

    await expect(auth.login({
      email: "legacy@example.com",
      password: "legacy password",
      now,
    })).resolves.toMatchObject({ account: { id: "acct_legacy" } });

    const credential = await repository.findAccountCredentialByEmail("legacy@example.com");
    expect(credential?.passwordHash).toMatch(/^scrypt\$32768\$8\$3\$/);
    expect(passwordHashNeedsRehash(credential?.passwordHash ?? "")).toBe(false);
    await expect(auth.lookupSession("existing session token", now)).resolves.toMatchObject({
      session: { id: "sess_existing", revokedAt: undefined },
    });
  });

  it("does not create a session when a real password change wins the upgrade race", async () => {
    const repository = new PausedPasswordUpgradeRepository();
    repository.createAccount({
      id: "acct_race",
      email: "race@example.com",
      passwordHash: legacyPasswordHash,
      now,
    });
    const auth = createAuthService({ repository });
    const login = auth.login({ email: "race@example.com", password: "legacy password", now });
    await repository.upgradeStarted;

    repository.replacePasswordAndRevokeSessions({
      accountId: "acct_race",
      expectedPasswordHash: legacyPasswordHash,
      passwordHash: hashPassword("replacement password"),
      now: new Date(now.getTime() + 1),
    });
    repository.allowUpgrade();

    await expect(login).resolves.toBeNull();
    expect(repository.sessions()).toEqual([]);
  });
});
