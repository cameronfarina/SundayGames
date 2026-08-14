import { InMemoryPlatformStore, createClientAddressRateLimiter, createNormalizedEmailRateLimiter, createPlatformApp, createPlatformHttpHandler, describe, expect, it, mockRunner, now } from "../support/index.js";
import type { PlatformHttpRequest } from "../support/index.js";

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
        newPassword: "replacement secure password",
        newPasswordConfirmation: "replacement secure password",
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
      body: { email: "User@Example.com", password: "secure password" },
    })).resolves.toMatchObject({ status: 201 });
    await expect(handle({
      method: "POST",
      path: "/accounts",
      clientAddress: "127.0.0.1",
      now,
      body: { email: " user@example.COM ", password: "secure password" },
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
});
