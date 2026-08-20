import { describe, expect, it } from "vitest";
import {
  AuthError,
  CapturingAuthMailSender,
  InMemoryAuthRepository,
  createAuthService,
  hashPassword,
} from "../src/platform/auth.js";

const concurrentAttempts = 20;
const now = new Date("2026-08-14T12:00:00.000Z");

const tokenFromLatestMessage = (mail: CapturingAuthMailSender): string => {
  const actionUrl = mail.messages.at(-1)?.actionUrl;
  if (actionUrl === undefined) throw new Error("Expected an authentication email.");
  return new URL(actionUrl).searchParams.get("token") ?? "";
};

const expectSingleWinner = (
  results: readonly PromiseSettledResult<unknown>[],
): void => {
  let fulfilled = 0;
  for (const result of results) {
    if (result.status === "fulfilled") {
      fulfilled += 1;
      continue;
    }
    expect(result.reason).toEqual(
      new AuthError("invalid_or_expired_token", "This link is invalid or has expired."),
    );
  }
  expect(fulfilled).toBe(1);
};

const setup = () => {
  const repository = new InMemoryAuthRepository();
  const mail = new CapturingAuthMailSender();
  const storedHash = hashPassword("mailbox proven password1!");
  let hashCalls = 0;
  const auth = createAuthService({
    repository,
    emailVerificationRequired: true,
    mailSender: mail,
    publicBaseUrl: "https://mockd.test",
    passwordHasher: async () => {
      hashCalls += 1;
      await Promise.resolve();
      return storedHash;
    },
  });
  return { auth, mail, hashCalls: () => hashCalls };
};

describe("single-use authentication token admission", () => {
  it("admits one password hash for concurrent email verification", async () => {
    const fixture = setup();
    await fixture.auth.createUser({ email: "verify@example.com", now });
    const callsBeforeVerification = fixture.hashCalls();
    const token = tokenFromLatestMessage(fixture.mail);

    const results = await Promise.allSettled(Array.from(
      { length: concurrentAttempts },
      () => fixture.auth.verifyEmail({
        token,
        newPassword: "mailbox proven password1!",
        newPasswordConfirmation: "mailbox proven password1!",
        now,
      }),
    ));

    expectSingleWinner(results);
    expect(fixture.hashCalls() - callsBeforeVerification).toBe(1);
  });

  it("admits one password hash for concurrent password reset", async () => {
    const fixture = setup();
    await fixture.auth.createUser({ email: "reset@example.com", now });
    await fixture.auth.verifyEmail({
      token: tokenFromLatestMessage(fixture.mail),
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now,
    });
    await fixture.auth.requestPasswordReset({ email: "reset@example.com", now });
    const callsBeforeReset = fixture.hashCalls();
    const token = tokenFromLatestMessage(fixture.mail);

    const results = await Promise.allSettled(Array.from(
      { length: concurrentAttempts },
      () => fixture.auth.resetPasswordWithToken({
        token,
        newPassword: "replacement secure password1!",
        newPasswordConfirmation: "replacement secure password1!",
        now,
      }),
    ));

    expectSingleWinner(results);
    expect(fixture.hashCalls() - callsBeforeReset).toBe(1);
  });

  it("keeps a token usable when password hashing fails before final consumption", async () => {
    const repository = new InMemoryAuthRepository();
    const mail = new CapturingAuthMailSender();
    const storedHash = hashPassword("mailbox proven password1!");
    let hashCalls = 0;
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender: mail,
      publicBaseUrl: "https://mockd.test",
      passwordHasher: async () => {
        hashCalls += 1;
        if (hashCalls === 2) throw new Error("temporary hashing failure");
        return storedHash;
      },
    });
    await auth.createUser({ email: "retry@example.com", now });
    const token = tokenFromLatestMessage(mail);
    const input = {
      token,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now,
    };

    await expect(auth.verifyEmail(input)).rejects.toThrow("temporary hashing failure");
    await expect(auth.verifyEmail(input)).resolves.toMatchObject({
      email: "retry@example.com",
    });
  });
});
