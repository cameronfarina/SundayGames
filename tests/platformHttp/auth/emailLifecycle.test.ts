import { CapturingAuthMailSender, InMemoryPlatformStore, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now } from "../support/index.js";

describe("platform HTTP contract", () => {
it("verifies production signups and keeps password resets non-enumerating", async () => {
    const mailSender = new CapturingAuthMailSender();
    const app = createPlatformApp({
      store: new InMemoryPlatformStore(),
      simulationRunner: mockRunner,
      authEmail: {
        verificationRequired: true,
        mailSender,
        publicBaseUrl: "https://mockd.example.com",
      },
    });
    const handle = createPlatformHttpHandler(app, { emailVerificationRequired: true });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      now,
      body: {
        email: "owner@example.com",
        returnTo: "/invite?token=league-invite",
      },
    })).resolves.toEqual({
      status: 202,
      body: {
        accepted: true,
        message: "Check your email for a verification link to finish your account.",
      },
    });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      now,
      body: { email: "owner@example.com", password: "attacker supplied password1!" },
    })).resolves.toMatchObject({
      status: 401,
      body: { error: { code: "invalid_credentials" } },
    });

    const verificationMessage = mailSender.messages[0];
    if (verificationMessage === undefined) throw new Error("Expected a verification email.");
    const verificationUrl = new URL(verificationMessage.actionUrl);
    const verificationToken = verificationUrl.searchParams.get("token");
    if (verificationToken === null) throw new Error("Expected a verification token.");
    expect(verificationUrl.searchParams.get("returnTo"))
      .toBe("/invite?token=league-invite");
    await expect(handle({
      method: "POST",
      path: "/email-verifications/consume",
      now: new Date(now.getTime() + 500),
      body: { token: verificationToken },
    })).resolves.toMatchObject({ status: 400 });
    await expect(handle({
      method: "POST",
      path: "/email-verifications/consume",
      now: new Date(now.getTime() + 1_000),
      body: {
        token: verificationToken,
        newPassword: "mailbox proven password1!",
        newPasswordConfirmation: "mailbox proven password1!",
      },
    })).resolves.toEqual({ status: 200, body: { verified: true } });
    const mailCountAfterVerification = mailSender.messages.length;
    await expect(handle({
      method: "POST",
      path: "/accounts",
      now: new Date(now.getTime() + 1_500),
      body: { email: "OWNER@example.com" },
    })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "duplicate_email",
          message: "An account with this email already exists.",
        },
      },
    });
    expect(mailSender.messages).toHaveLength(mailCountAfterVerification);
    await expect(handle({
      method: "POST",
      path: "/sessions",
      now: new Date(now.getTime() + 2_000),
      body: { email: "owner@example.com", password: "attacker supplied password1!" },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      now: new Date(now.getTime() + 2_000),
      body: { email: "owner@example.com", password: "mailbox proven password1!" },
    })).resolves.toMatchObject({ status: 200 });

    const missingReset = await handle({
      method: "POST",
      path: "/password-resets",
      now,
      body: { email: "missing@example.com" },
    });
    const existingReset = await handle({
      method: "POST",
      path: "/password-resets",
      now,
      body: { email: "owner@example.com" },
    });
    expect(existingReset).toEqual(missingReset);
    const resetMessage = mailSender.messages.at(-1);
    if (resetMessage === undefined) throw new Error("Expected a password reset email.");
    const resetToken = new URL(resetMessage.actionUrl).searchParams.get("token");
    if (resetToken === null) throw new Error("Expected a password reset token.");
    await expect(handle({
      method: "POST",
      path: "/password-resets/consume",
      now: new Date(now.getTime() + 3_000),
      body: {
        token: resetToken,
        newPassword: "replacement password1!",
        newPasswordConfirmation: "replacement password1!",
      },
    })).resolves.toEqual({ status: 200, body: { reset: true } });
  });
});
