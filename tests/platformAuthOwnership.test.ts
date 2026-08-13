import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  CapturingAuthMailSender,
  InMemoryAuthRepository,
  createAuthService,
} from "../src/platform/auth.js";

const now = new Date("2026-08-11T13:00:00.000Z");
const verificationTokenFrom = (url: string): string => new URL(url).searchParams.get("token") ?? "";

describe("email ownership and password recovery", () => {
  it("keeps production signups pending until a single-use verification token is consumed", async () => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    const account = await auth.createUser({
      email: " Owner@Example.com ",
      password: "first secure password",
      verificationReturnTo: "/invite?token=league-invite",
      now,
    });

    expect(account.emailVerifiedAt).toBeUndefined();
    expect(mailSender.messages).toHaveLength(1);
    expect(new URL(mailSender.messages[0]!.actionUrl).searchParams.get("returnTo"))
      .toBe("/invite?token=league-invite");
    expect(JSON.stringify(repository.authTokens())).not.toContain(
      verificationTokenFrom(mailSender.messages[0]!.actionUrl),
    );
    await expect(auth.login({
      email: "owner@example.com",
      password: "first secure password",
      now,
    })).rejects.toThrow(new AuthError(
      "email_unverified",
      "Verify your email before signing in. We can send you a new verification link.",
    ));

    const token = verificationTokenFrom(mailSender.messages[0]!.actionUrl);
    await expect(auth.verifyEmail({ token, now: new Date(now.getTime() + 1_000) }))
      .resolves.toMatchObject({ emailVerifiedAt: new Date(now.getTime() + 1_000) });
    await expect(auth.verifyEmail({ token, now: new Date(now.getTime() + 2_000) }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
    await expect(auth.login({
      email: "owner@example.com",
      password: "first secure password",
      now: new Date(now.getTime() + 3_000),
    })).resolves.toMatchObject({ account: { email: "owner@example.com" } });
  });

  it.each([
    "/\\evil.example/phish",
    "/%5Cevil.example/phish",
    "/%255Cevil.example/phish",
    "/%2525252525252525255Cevil.example/phish",
    "//evil.example/phish",
  ])("does not preserve unsafe return path %s in verification mail", async verificationReturnTo => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    await auth.createUser({
      email: "owner@example.com",
      password: "first secure password",
      verificationReturnTo,
      now,
    });

    expect(new URL(mailSender.messages[0]!.actionUrl).searchParams.has("returnTo")).toBe(false);
  });

  it("reissues a pending signup token without replacing the original password", async () => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    await auth.createUser({ email: "owner@example.com", password: "first secure password", now });
    const firstToken = verificationTokenFrom(mailSender.messages[0]!.actionUrl);
    await auth.createUser({
      email: " OWNER@example.com ",
      password: "replacement secure password",
      now: new Date(now.getTime() + 1_000),
    });
    const secondToken = verificationTokenFrom(mailSender.messages[1]!.actionUrl);

    expect(secondToken).not.toBe(firstToken);
    await expect(auth.verifyEmail({ token: firstToken, now: new Date(now.getTime() + 2_000) }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
    await auth.verifyEmail({ token: secondToken, now: new Date(now.getTime() + 2_000) });
    await expect(auth.login({
      email: "owner@example.com",
      password: "first secure password",
      now: new Date(now.getTime() + 3_000),
    })).resolves.not.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "replacement secure password",
      now: new Date(now.getTime() + 3_000),
    })).resolves.toBeNull();

    await auth.createUser({
      email: "owner@example.com",
      password: "attacker controlled password",
      now: new Date(now.getTime() + 4_000),
    });
    expect(mailSender.messages).toHaveLength(2);
    await expect(auth.login({
      email: "owner@example.com",
      password: "first secure password",
      now: new Date(now.getTime() + 5_000),
    })).resolves.not.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker controlled password",
      now: new Date(now.getTime() + 5_000),
    })).resolves.toBeNull();
  });

  it("issues non-enumerating reset requests and atomically consumes reset tokens", async () => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: false,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });
    await auth.createUser({ email: "owner@example.com", password: "first secure password", now });
    const session = await auth.login({ email: "owner@example.com", password: "first secure password", now });
    expect(session).not.toBeNull();

    await expect(auth.requestPasswordReset({ email: "missing@example.com", now })).resolves.toEqual({ accepted: true });
    expect(mailSender.messages).toHaveLength(0);
    await expect(auth.requestPasswordReset({ email: "OWNER@example.com", now })).resolves.toEqual({ accepted: true });
    expect(mailSender.messages).toHaveLength(1);
    const token = verificationTokenFrom(mailSender.messages[0]!.actionUrl);

    await expect(auth.resetPasswordWithToken({
      token,
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({ revokedSessionCount: 1 });
    await expect(auth.lookupSession(session!.sessionToken, new Date(now.getTime() + 2_000))).resolves.toBeNull();
    await expect(auth.resetPasswordWithToken({
      token,
      newPassword: "another secure password",
      newPasswordConfirmation: "another secure password",
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
  });

  it("rejects an unusable reset token before password hashing reaches the repository mutation", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const resetPassword = vi.spyOn(repository, "resetPasswordByToken");

    await expect(auth.resetPasswordWithToken({
      token: "invalid-token",
      newPassword: "replacement secure password",
      newPasswordConfirmation: "replacement secure password",
      now,
    })).rejects.toThrow(new AuthError(
      "invalid_or_expired_token",
      "This link is invalid or has expired.",
    ));
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("expires verification and reset tokens", async () => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
      verificationTokenTtlMs: 1_000,
      passwordResetTokenTtlMs: 1_000,
    });
    await auth.createUser({ email: "owner@example.com", password: "secure password", now });
    const verificationToken = verificationTokenFrom(mailSender.messages[0]!.actionUrl);

    await expect(auth.verifyEmail({ token: verificationToken, now: new Date(now.getTime() + 1_001) }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
  });
});
