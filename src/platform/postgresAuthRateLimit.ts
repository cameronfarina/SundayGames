import { createHash } from "node:crypto";
import type {
  AuthAttemptRateLimiter,
  AuthRateLimitDecision,
} from "./authRateLimit.js";
import { PostgresAuthRateLimitWindowRepository } from "./postgresAuthRateLimit/windowRepository.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";

export interface PostgresAuthRateLimiterOptions {
  scope: string;
  maxAttempts: number;
  windowMs: number;
  maxTrackedKeys: number;
  cleanupBatchSize: number;
  normalizeKey: (key: string) => string;
}

export class PostgresAuthRateLimiter implements AuthAttemptRateLimiter {
  readonly #options: PostgresAuthRateLimiterOptions;
  readonly #windows: PostgresAuthRateLimitWindowRepository;

  constructor(
    client: PostgresTransactionalQueryClient,
    options: PostgresAuthRateLimiterOptions,
  ) {
    assertPositiveSafeInteger(options.maxAttempts, "maxAttempts");
    assertPositiveSafeInteger(options.windowMs, "windowMs");
    assertPositiveSafeInteger(options.maxTrackedKeys, "maxTrackedKeys");
    assertPositiveSafeInteger(options.cleanupBatchSize, "cleanupBatchSize");
    if (options.scope.trim().length === 0) throw new RangeError("scope must not be blank.");
    this.#options = options;
    this.#windows = new PostgresAuthRateLimitWindowRepository(client, options.scope, client);
  }

  async consume(key: string, now = new Date()): Promise<AuthRateLimitDecision> {
    const nowMs = validDateMs(now);
    const keyHash = this.#keyHash(key);

    return await this.#windows.transaction(keyHash, async windows => {
      await windows.deleteExpired(now, this.#options.cleanupBatchSize);
      const existing = await windows.find(keyHash);
      if (existing !== undefined) {
        const resetAt = dateValue(existing.reset_at, "reset_at");
        if (resetAt.getTime() <= nowMs) {
          await windows.replace(keyHash, new Date(nowMs + this.#options.windowMs), now);
          return allowedDecision(this.#options.maxAttempts - 1);
        }
        const attemptCount = integerValue(existing.attempt_count, "attempt_count");
        if (attemptCount >= this.#options.maxAttempts) {
          return deniedDecision(resetAt.getTime() - nowMs);
        }
        await windows.increment(keyHash, now);
        return allowedDecision(this.#options.maxAttempts - attemptCount - 1);
      }

      await windows.lockCapacity();
      const capacity = await windows.capacity(now);
      if (integerValue(capacity.tracked_count, "tracked_count") >= this.#options.maxTrackedKeys) {
        const earliestResetAt = dateValue(capacity.earliest_reset_at, "earliest_reset_at");
        return deniedDecision(Math.max(0, earliestResetAt.getTime() - nowMs));
      }
      await windows.insert(keyHash, new Date(nowMs + this.#options.windowMs), now);
      return allowedDecision(this.#options.maxAttempts - 1);
    });
  }

  async reset(key: string): Promise<void> {
    const keyHash = this.#keyHash(key);
    await this.#windows.transaction(keyHash, async windows => {
      await windows.delete(keyHash);
    });
  }

  #keyHash(key: string): string {
    const normalizedKey = this.#options.normalizeKey(key);
    if (normalizedKey.length === 0) throw new RangeError("Rate-limit key must not be blank.");
    return createHash("sha256").update(normalizedKey).digest("base64url");
  }
}

const allowedDecision = (remainingAttempts: number): AuthRateLimitDecision => ({
  allowed: true,
  remainingAttempts,
  retryAfterMs: 0,
});

const deniedDecision = (retryAfterMs: number): AuthRateLimitDecision => ({
  allowed: false,
  remainingAttempts: 0,
  retryAfterMs,
});

const validDateMs = (value: Date): number => {
  const milliseconds = value.getTime();
  if (!Number.isFinite(milliseconds)) throw new RangeError("now must be a valid date.");
  return milliseconds;
};

const dateValue = (value: Date | string | null, name: string): Date => {
  if (value === null) throw new Error(`Postgres ${name} must not be null.`);
  const date = value instanceof Date ? value : new Date(value);
  validDateMs(date);
  return date;
};

const integerValue = (value: number | string, name: string): number => {
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`Postgres ${name} must be a non-negative safe integer.`);
  }
  return number;
};

const assertPositiveSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
};
