import { describe, expect, it, vi } from "vitest";
import {
  AuthError,
  CapturingAuthMailSender,
  InMemoryAuthRepository,
  createAuthService,
  type PendingAccountRegistrationResult,
} from "../src/platform/auth.js";

const now = new Date("2026-08-11T13:00:00.000Z");
const verificationTokenFrom = (url: string): string => new URL(url).searchParams.get("token") ?? "";
const credentialVersionOf = (registration: PendingAccountRegistrationResult): number => {
  if (registration.status === "verified") throw new Error("Expected a pending account registration.");
  return registration.credentialVersion;
};

describe("email ownership and password recovery", () => {
  it("prevents an attacker-first signup password from surviving mailbox verification", async () => {
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
      verificationReturnTo: "/invite?token=league-invite",
      now,
    });

    expect(account.emailVerifiedAt).toBeUndefined();
    expect(mailSender.messages).toHaveLength(1);
    expect(mailSender.messages[0]?.text).toContain("choose your Sunday Games password");
    expect(new URL(mailSender.messages[0]!.actionUrl).searchParams.get("returnTo"))
      .toBe("/invite?token=league-invite");
    expect(JSON.stringify(repository.authTokens())).not.toContain(
      verificationTokenFrom(mailSender.messages[0]!.actionUrl),
    );
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker supplied password1!",
      now,
    })).resolves.toBeNull();

    const token = verificationTokenFrom(mailSender.messages[0]!.actionUrl);
    await expect(auth.verifyEmail({
      token,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now: new Date(now.getTime() + 1_000),
    }))
      .resolves.toMatchObject({ emailVerifiedAt: new Date(now.getTime() + 1_000) });
    await expect(auth.verifyEmail({
      token,
      newPassword: "another secure password1!",
      newPasswordConfirmation: "another secure password1!",
      now: new Date(now.getTime() + 2_000),
    }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker supplied password1!",
      now: new Date(now.getTime() + 3_000),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "mailbox proven password1!",
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
      verificationReturnTo,
      now,
    });

    expect(new URL(mailSender.messages[0]!.actionUrl).searchParams.has("returnTo")).toBe(false);
  });

  it("prevents an attacker-last signup password from surviving mailbox verification", async () => {
    const repository = new InMemoryAuthRepository();
    const mailSender = new CapturingAuthMailSender();
    const auth = createAuthService({
      repository,
      emailVerificationRequired: true,
      mailSender,
      publicBaseUrl: "https://mockd.example.com",
    });

    await auth.createUser({ email: "owner@example.com", now });
    const firstToken = verificationTokenFrom(mailSender.messages[0]!.actionUrl);
    await auth.createUser({
      email: " OWNER@example.com ",
      now: new Date(now.getTime() + 1_000),
    });
    const secondToken = verificationTokenFrom(mailSender.messages[1]!.actionUrl);

    expect(secondToken).not.toBe(firstToken);
    await expect(auth.verifyEmail({
      token: firstToken,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now: new Date(now.getTime() + 2_000),
    }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
    await auth.verifyEmail({
      token: secondToken,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now: new Date(now.getTime() + 2_000),
    });
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker first password1!",
      now: new Date(now.getTime() + 3_000),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker last password1!",
      now: new Date(now.getTime() + 3_000),
    })).resolves.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "mailbox proven password1!",
      now: new Date(now.getTime() + 3_000),
    })).resolves.not.toBeNull();

    await auth.createUser({
      email: "owner@example.com",
      now: new Date(now.getTime() + 4_000),
    });
    expect(mailSender.messages).toHaveLength(2);
    await expect(auth.login({
      email: "owner@example.com",
      password: "mailbox proven password1!",
      now: new Date(now.getTime() + 5_000),
    })).resolves.not.toBeNull();
    await expect(auth.login({
      email: "owner@example.com",
      password: "attacker controlled password1!",
      now: new Date(now.getTime() + 5_000),
    })).resolves.toBeNull();
  });

  it("rejects verification tokens from a stale concurrent pending signup", () => {
    const repository = new InMemoryAuthRepository();
    const initial = repository.createOrReplacePendingAccount({
      id: "acct_owner",
      email: "owner@example.com",
      passwordHash: "attacker hash",
      now,
    });
    repository.replaceAuthToken({
      id: "token_initial",
      accountId: initial.account.id,
      purpose: "email_verification",
      tokenHash: "initial token hash",
      createdAt: now,
      expiresAt: new Date(now.getTime() + 60_000),
      expectedCredentialVersion: credentialVersionOf(initial),
    });

    const stale = repository.createOrReplacePendingAccount({
      id: "acct_stale",
      email: "owner@example.com",
      passwordHash: "stale attacker hash",
      now: new Date(now.getTime() + 1_000),
    });
    const current = repository.createOrReplacePendingAccount({
      id: "acct_current",
      email: "owner@example.com",
      passwordHash: "victim hash",
      now: new Date(now.getTime() + 2_000),
    });

    expect(repository.replaceAuthToken({
      id: "token_stale",
      accountId: stale.account.id,
      purpose: "email_verification",
      tokenHash: "stale token hash",
      createdAt: new Date(now.getTime() + 1_000),
      expiresAt: new Date(now.getTime() + 61_000),
      expectedCredentialVersion: credentialVersionOf(stale),
    })).toBeNull();
    expect(repository.replaceAuthToken({
      id: "token_current",
      accountId: current.account.id,
      purpose: "email_verification",
      tokenHash: "current token hash",
      createdAt: new Date(now.getTime() + 2_000),
      expiresAt: new Date(now.getTime() + 62_000),
      expectedCredentialVersion: credentialVersionOf(current),
    })).not.toBeNull();
    expect(repository.verifyEmailAndSetPasswordByToken({
      tokenHash: "initial token hash",
      passwordHash: "mailbox proven hash",
      now: new Date(now.getTime() + 3_000),
    })).toBeNull();
    expect(repository.verifyEmailAndSetPasswordByToken({
      tokenHash: "current token hash",
      passwordHash: "mailbox proven hash",
      now: new Date(now.getTime() + 3_000),
    })).not.toBeNull();
    expect(repository.findAccountCredentialByEmail("owner@example.com")?.passwordHash)
      .toBe("mailbox proven hash");
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
    await auth.createUser({ email: "owner@example.com", password: "first secure password1!", now });
    const session = await auth.login({ email: "owner@example.com", password: "first secure password1!", now });
    expect(session).not.toBeNull();

    await expect(auth.requestPasswordReset({ email: "missing@example.com", now })).resolves.toEqual({ accepted: true });
    expect(mailSender.messages).toHaveLength(0);
    await expect(auth.requestPasswordReset({ email: "OWNER@example.com", now })).resolves.toEqual({ accepted: true });
    expect(mailSender.messages).toHaveLength(1);
    const token = verificationTokenFrom(mailSender.messages[0]!.actionUrl);

    await expect(auth.resetPasswordWithToken({
      token,
      newPassword: "replacement secure password1!",
      newPasswordConfirmation: "replacement secure password1!",
      now: new Date(now.getTime() + 1_000),
    })).resolves.toMatchObject({ revokedSessionCount: 1 });
    await expect(auth.lookupSession(session!.sessionToken, new Date(now.getTime() + 2_000))).resolves.toBeNull();
    await expect(auth.resetPasswordWithToken({
      token,
      newPassword: "another secure password1!",
      newPasswordConfirmation: "another secure password1!",
      now: new Date(now.getTime() + 2_000),
    })).rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
  });

  it("rejects an unusable reset token before password hashing reaches the repository mutation", async () => {
    const repository = new InMemoryAuthRepository();
    const auth = createAuthService({ repository });
    const resetPassword = vi.spyOn(repository, "resetPasswordByToken");

    await expect(auth.resetPasswordWithToken({
      token: "invalid-token",
      newPassword: "replacement secure password1!",
      newPasswordConfirmation: "replacement secure password1!",
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
    await auth.createUser({ email: "owner@example.com", password: "secure password1!", now });
    const verificationToken = verificationTokenFrom(mailSender.messages[0]!.actionUrl);

    await expect(auth.verifyEmail({
      token: verificationToken,
      newPassword: "mailbox proven password1!",
      newPasswordConfirmation: "mailbox proven password1!",
      now: new Date(now.getTime() + 1_001),
    }))
      .rejects.toThrow(new AuthError("invalid_or_expired_token", "This link is invalid or has expired."));
  });
});
