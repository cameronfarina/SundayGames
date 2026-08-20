import { describe, expect, it } from "vitest";
import {
  AuthError,
  InMemoryAuthRepository,
  createAuthService,
  maximumDisplayNameCharacters,
  validatedDisplayName,
  type AuthService,
  type LoginResult,
} from "../src/platform/auth.js";

const now = new Date("2026-08-09T12:00:00.000Z");
const password = "valid password phrase1!";

const signedIn = async (): Promise<{ auth: AuthService; login: LoginResult }> => {
  const auth = createAuthService({ repository: new InMemoryAuthRepository() });
  await auth.createUser({ email: "display-name@mockd.app", password, now });
  const login = await auth.login({ email: "display-name@mockd.app", password, now });
  if (login === null) throw new Error("Expected the login to succeed.");
  return { auth, login };
};

describe("validatedDisplayName", () => {
  it("trims and collapses the whitespace inside a name", () => {
    expect(validatedDisplayName("  Cam   Farina  ")).toBe("Cam Farina");
  });

  it("treats a blank name as no name at all", () => {
    expect(validatedDisplayName("   ")).toBeUndefined();
    expect(validatedDisplayName("")).toBeUndefined();
  });

  it("accepts a name exactly at the limit", () => {
    const atLimit = "c".repeat(maximumDisplayNameCharacters);

    expect(validatedDisplayName(atLimit)).toBe(atLimit);
  });

  it("rejects a name past the limit", () => {
    expect(() => validatedDisplayName("c".repeat(maximumDisplayNameCharacters + 1)))
      .toThrow(AuthError);
  });
});

describe("updateDisplayName", () => {
  it("stores the name and hands it back on the next session lookup", async () => {
    const { auth, login } = await signedIn();
    const savedAt = new Date(now.getTime() + 1);

    await expect(auth.updateDisplayName({
      displayName: "Cam Farina",
      now: savedAt,
      sessionToken: login.sessionToken,
    })).resolves.toMatchObject({ displayName: "Cam Farina", updatedAt: savedAt });

    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 2)))
      .resolves.toMatchObject({ account: { displayName: "Cam Farina" } });
  });

  it("clears the stored name when given a blank one", async () => {
    const { auth, login } = await signedIn();
    await auth.updateDisplayName({
      displayName: "Cam Farina",
      now: new Date(now.getTime() + 1),
      sessionToken: login.sessionToken,
    });

    const cleared = await auth.updateDisplayName({
      displayName: "  ",
      now: new Date(now.getTime() + 2),
      sessionToken: login.sessionToken,
    });

    expect(cleared.displayName).toBeUndefined();
    expect(Object.hasOwn(cleared, "displayName")).toBe(false);
  });

  it("leaves the session and the password alone", async () => {
    const { auth, login } = await signedIn();

    await auth.updateDisplayName({
      displayName: "Cam Farina",
      now: new Date(now.getTime() + 1),
      sessionToken: login.sessionToken,
    });

    await expect(auth.lookupSession(login.sessionToken, new Date(now.getTime() + 2)))
      .resolves.not.toBeNull();
    await expect(auth.login({ email: "display-name@mockd.app", password, now }))
      .resolves.not.toBeNull();
  });

  it("refuses a name from an unknown session", async () => {
    const { auth } = await signedIn();

    await expect(auth.updateDisplayName({
      displayName: "Cam Farina",
      now,
      sessionToken: "not-a-session-token",
    })).rejects.toThrow(AuthError);
  });

  it("refuses a name from a session that has been signed out", async () => {
    const { auth, login } = await signedIn();
    await auth.logout(login.sessionToken, new Date(now.getTime() + 1));

    await expect(auth.updateDisplayName({
      displayName: "Cam Farina",
      now: new Date(now.getTime() + 2),
      sessionToken: login.sessionToken,
    })).rejects.toThrow(AuthError);
  });

  it("refuses a name from an expired session", async () => {
    const { auth, login } = await signedIn();

    await expect(auth.updateDisplayName({
      displayName: "Cam Farina",
      now: new Date(login.session.expiresAt.getTime() + 1),
      sessionToken: login.sessionToken,
    })).rejects.toThrow(AuthError);
  });

  it("refuses a name past the length limit", async () => {
    const { auth, login } = await signedIn();

    await expect(auth.updateDisplayName({
      displayName: "c".repeat(maximumDisplayNameCharacters + 1),
      now: new Date(now.getTime() + 1),
      sessionToken: login.sessionToken,
    })).rejects.toThrow(AuthError);
  });
});
