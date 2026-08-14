import { normalizeEmail } from "./auth.js";

export interface CreateNormalizedEmailRateLimiterOptions {
  maxAttempts: number;
  windowMs: number;
  maxTrackedEmails: number;
}

export interface AuthRateLimitDecision {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterMs: number;
}

export interface NormalizedEmailRateLimiter {
  consume(email: string, now?: Date): AuthRateLimitDecision;
  reset(email: string): void;
}

export interface ClientAddressRateLimiter {
  consume(clientAddress: string, now?: Date): AuthRateLimitDecision;
  reset(clientAddress: string): void;
}

interface AttemptWindow {
  attempts: number;
  resetAtMs: number;
}

const createBoundedRateLimiter = (
  options: CreateNormalizedEmailRateLimiterOptions,
  normalizeKey: (key: string) => string,
): NormalizedEmailRateLimiter => {
  assertPositiveSafeInteger(options.maxAttempts, "maxAttempts");
  assertPositiveSafeInteger(options.windowMs, "windowMs");
  assertPositiveSafeInteger(options.maxTrackedEmails, "maxTrackedEmails");

  const attemptsByEmail = new Map<string, AttemptWindow>();

  return {
    consume: (email, now = new Date()) => {
      const normalizedEmail = normalizeKey(email);
      const nowMs = now.getTime();

      if (!Number.isFinite(nowMs)) {
        throw new RangeError("now must be a valid date.");
      }

      purgeExpiredWindows(attemptsByEmail, nowMs);
      const currentWindow = attemptsByEmail.get(normalizedEmail);
      if (currentWindow === undefined) {
        if (attemptsByEmail.size >= options.maxTrackedEmails) {
          return {
            allowed: false,
            remainingAttempts: 0,
            retryAfterMs: earliestRetryAfterMs(attemptsByEmail, nowMs),
          };
        }

        attemptsByEmail.set(normalizedEmail, {
          attempts: 1,
          resetAtMs: nowMs + options.windowMs,
        });

        return {
          allowed: true,
          remainingAttempts: options.maxAttempts - 1,
          retryAfterMs: 0,
        };
      }

      if (currentWindow.attempts >= options.maxAttempts) {
        return {
          allowed: false,
          remainingAttempts: 0,
          retryAfterMs: currentWindow.resetAtMs - nowMs,
        };
      }

      currentWindow.attempts += 1;

      return {
        allowed: true,
        remainingAttempts: options.maxAttempts - currentWindow.attempts,
        retryAfterMs: 0,
      };
    },
    reset: email => {
      attemptsByEmail.delete(normalizeKey(email));
    },
  };
};

const purgeExpiredWindows = (attemptsByKey: Map<string, AttemptWindow>, nowMs: number): void => {
  for (const [key, window] of attemptsByKey) {
    if (window.resetAtMs <= nowMs) {
      attemptsByKey.delete(key);
    }
  }
};

const earliestRetryAfterMs = (attemptsByKey: Map<string, AttemptWindow>, nowMs: number): number => {
  let retryAfterMs = Number.POSITIVE_INFINITY;

  for (const window of attemptsByKey.values()) {
    retryAfterMs = Math.min(retryAfterMs, window.resetAtMs - nowMs);
  }

  return Number.isFinite(retryAfterMs) ? retryAfterMs : 0;
};

export const createNormalizedEmailRateLimiter = (
  options: CreateNormalizedEmailRateLimiterOptions,
): NormalizedEmailRateLimiter => createBoundedRateLimiter(options, normalizeEmail);

export const createClientAddressRateLimiter = (
  options: CreateNormalizedEmailRateLimiterOptions,
): ClientAddressRateLimiter => createBoundedRateLimiter(options, value => value.trim().toLowerCase() || "unknown");

const assertPositiveSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
};
