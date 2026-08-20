import { InMemoryPlatformStore, createClientAddressRateLimiter, createNormalizedEmailRateLimiter, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now } from "../support/index.js";
import type { PlatformHttpRequest } from "../support/index.js";

const loginRequest = (
  clientAddress: string,
  email: string,
  password: string,
): PlatformHttpRequest => ({
  method: "POST",
  path: "/sessions",
  clientAddress,
  now,
  body: { email, password },
});

describe("platform HTTP contract", () => {
it("rate limits verification and password reset requests by normalized email", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      verificationRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
      passwordResetRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    await expect(handle({
      method: "POST",
      path: "/email-verifications",
      clientAddress: "127.0.0.1",
      now,
      body: { email: "Owner@Example.com" },
    })).resolves.toMatchObject({ status: 202 });
    await expect(handle({
      method: "POST",
      path: "/email-verifications",
      clientAddress: "127.0.0.1",
      now,
      body: { email: " owner@example.COM " },
    })).resolves.toMatchObject({ status: 429, body: { error: { code: "auth_rate_limited" } } });

    await expect(handle({
      method: "POST",
      path: "/password-resets",
      clientAddress: "127.0.0.2",
      now,
      body: { email: "Owner@Example.com" },
    })).resolves.toMatchObject({ status: 202 });
    await expect(handle({
      method: "POST",
      path: "/password-resets",
      clientAddress: "127.0.0.2",
      now,
      body: { email: " owner@example.COM " },
    })).resolves.toMatchObject({ status: 429, body: { error: { code: "auth_rate_limited" } } });
  });

it("rate limits password reset consumption by client address", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      passwordResetConsumeRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const request: PlatformHttpRequest = {
      method: "POST",
      path: "/password-resets/consume",
      clientAddress: "127.0.0.3",
      now,
      body: {
        token: "invalid-token",
        newPassword: "replacement secure password1!",
        newPasswordConfirmation: "replacement secure password1!",
      },
    };

    await expect(handle(request)).resolves.toMatchObject({ status: 400 });
    await expect(handle(request)).resolves.toMatchObject({
      status: 429,
      body: { error: { code: "rate_limited" } },
    });
  });

it("rate limits normalized account attempts and client auth traffic", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    const handle = createPlatformHttpHandler(app, {
      accountRateLimiter: createNormalizedEmailRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
      authClientRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 10,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    await expect(handle({
      method: "POST",
      path: "/accounts",
      clientAddress: "127.0.0.1",
      now,
      body: { email: "User@Example.com", password: "secure password1!" },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/accounts",
      clientAddress: "127.0.0.1",
      now,
      body: { email: " user@example.COM ", password: "secure password1!" },
    })).resolves.toEqual({
      status: 429,
      headers: { "Retry-After": "60" },
      body: {
        error: {
          code: "auth_rate_limited",
          message: "Too many attempts. Try again later.",
        },
      },
    });
  });

it("does not let one client exhaust another client's login attempts for a target email", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    await app.createAccount({
      email: "target@example.com",
      password: "secure1!",
      now,
    });
    const handle = createPlatformHttpHandler(app, {
      loginRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });

    await expect(handle({
      method: "POST",
      path: "/sessions",
      clientAddress: "198.51.100.10",
      now,
      body: { email: "target@example.com", password: "wrong password" },
    })).resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      clientAddress: "198.51.100.10",
      now,
      body: { email: "target@example.com", password: "wrong again" },
    })).resolves.toMatchObject({
      status: 429,
      headers: { "Retry-After": "60" },
    });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      clientAddress: "203.0.113.20",
      now,
      body: { email: "target@example.com", password: "secure1!" },
    })).resolves.toMatchObject({ status: 200 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      clientAddress: "198.51.100.10",
      now,
      body: { email: "target@example.com", password: "wrong still" },
    })).resolves.toMatchObject({ status: 429 });
    await expect(handle({
      method: "POST",
      path: "/sessions",
      clientAddress: "203.0.113.20",
      now,
      body: { email: "target@example.com", password: "wrong after success" },
    })).resolves.toMatchObject({ status: 401 });
  });

it("keeps victim login failures after the same client signs in to another account", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    await app.createAccount({ email: "attacker@example.com", password: "attacker1!", now });
    await app.createAccount({ email: "victim@example.com", password: "victim1!", now });
    const handle = createPlatformHttpHandler(app, {
      loginRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const clientAddress = "198.51.100.30";

    await expect(handle(loginRequest(clientAddress, "victim@example.com", "wrong password")))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle(loginRequest(clientAddress, "attacker@example.com", "attacker1!")))
      .resolves.toMatchObject({ status: 200 });
    await expect(handle(loginRequest(clientAddress, "victim@example.com", "another wrong password")))
      .resolves.toMatchObject({
      status: 429,
      headers: { "Retry-After": "60" },
    });
  });

it("keeps victim login failures after the same client changes another account password", async () => {
    const app = createPlatformApp({ store: new InMemoryPlatformStore(), simulationRunner: mockRunner });
    await app.createAccount({ email: "attacker@example.com", password: "attacker1!", now });
    await app.createAccount({ email: "victim@example.com", password: "victim1!", now });
    const attackerLogin = await app.login({ email: "attacker@example.com", password: "attacker1!", now });
    if (attackerLogin === null) throw new Error("Expected attacker login.");
    const handle = createPlatformHttpHandler(app, {
      loginRateLimiter: createClientAddressRateLimiter({
        maxAttempts: 1,
        windowMs: 60_000,
        maxTrackedEmails: 100,
      }),
    });
    const clientAddress = "198.51.100.40";

    await expect(handle(loginRequest(clientAddress, "victim@example.com", "wrong password")))
      .resolves.toMatchObject({ status: 401 });
    await expect(handle({
      method: "PUT",
      path: "/session/password",
      clientAddress,
      sessionToken: attackerLogin.sessionToken,
      now,
      body: {
        currentPassword: "attacker1!",
        newPassword: "replacement2!",
        newPasswordConfirmation: "replacement2!",
      },
    })).resolves.toMatchObject({ status: 200 });
    await expect(handle(loginRequest(clientAddress, "victim@example.com", "another wrong password")))
      .resolves.toMatchObject({
      status: 429,
      headers: { "Retry-After": "60" },
    });
  });
});
