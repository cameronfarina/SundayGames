import { describe, expect, it } from "vitest";
import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
} from "../src/platform/authRateLimit.js";

const now = new Date("2026-08-10T12:00:00.000Z");

describe("normalized email auth rate limiter", () => {
  it("clears a successful account's attempt window", () => {
    const limiter = createNormalizedEmailRateLimiter({
      maxAttempts: 1,
      windowMs: 60_000,
      maxTrackedEmails: 100,
    });

    expect(limiter.consume("success@example.com", now).allowed).toBe(true);
    expect(limiter.consume("success@example.com", now).allowed).toBe(false);
    limiter.reset(" Success@Example.COM ");
    expect(limiter.consume("success@example.com", now).allowed).toBe(true);
  });

  it("counts case and whitespace variants of an email against one limit", () => {
    const limiter = createNormalizedEmailRateLimiter({
      maxAttempts: 1,
      windowMs: 60_000,
      maxTrackedEmails: 100,
    });

    expect(limiter.consume(" User@Example.COM ", now)).toEqual({
      allowed: true,
      remainingAttempts: 0,
      retryAfterMs: 0,
    });
    expect(limiter.consume("user@example.com", now)).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 60_000,
    });
  });

  it("keeps a blocked email protected when capacity is full", () => {
    const limiter = createNormalizedEmailRateLimiter({
      maxAttempts: 1,
      windowMs: 60_000,
      maxTrackedEmails: 2,
    });

    expect(limiter.consume("oldest@example.com", now).allowed).toBe(true);
    expect(limiter.consume("newer@example.com", now).allowed).toBe(true);
    expect(limiter.consume("newest@example.com", now)).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 60_000,
    });
    expect(limiter.consume("oldest@example.com", now)).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 60_000,
    });
  });

  it("resets attempts at the exact end of a fixed window", () => {
    const limiter = createNormalizedEmailRateLimiter({
      maxAttempts: 2,
      windowMs: 1_000,
      maxTrackedEmails: 100,
    });

    expect(limiter.consume("window@example.com", now).remainingAttempts).toBe(1);
    expect(limiter.consume("window@example.com", new Date(now.getTime() + 500)).remainingAttempts).toBe(0);
    expect(limiter.consume("window@example.com", new Date(now.getTime() + 999))).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 1,
    });
    expect(limiter.consume("window@example.com", new Date(now.getTime() + 1_000))).toEqual({
      allowed: true,
      remainingAttempts: 1,
      retryAfterMs: 0,
    });
  });

  it("reclaims expired entries before rejecting a new email", () => {
    const limiter = createNormalizedEmailRateLimiter({
      maxAttempts: 1,
      windowMs: 1_000,
      maxTrackedEmails: 2,
    });

    expect(limiter.consume("expires-first@example.com", now).allowed).toBe(true);
    expect(limiter.consume("still-active@example.com", new Date(now.getTime() + 500)).allowed).toBe(true);

    const afterFirstWindow = new Date(now.getTime() + 1_000);
    expect(limiter.consume("new@example.com", afterFirstWindow)).toEqual({
      allowed: true,
      remainingAttempts: 0,
      retryAfterMs: 0,
    });

    expect(limiter.consume("still-active@example.com", afterFirstWindow)).toEqual({
      allowed: false,
      remainingAttempts: 0,
      retryAfterMs: 500,
    });
  });

  it("can bound all auth attempts from one client address", () => {
    const limiter = createClientAddressRateLimiter({
      maxAttempts: 1,
      windowMs: 60_000,
      maxTrackedEmails: 100,
    });

    expect(limiter.consume(" 127.0.0.1 ", now).allowed).toBe(true);
    expect(limiter.consume("127.0.0.1", now)).toMatchObject({
      allowed: false,
      retryAfterMs: 60_000,
    });
  });
});
