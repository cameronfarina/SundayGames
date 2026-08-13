import type { ClientAddressRateLimiter } from "./authRateLimit.js";

export interface HistoricalImportRequestAdmissionOptions {
  accountRateLimiter: ClientAddressRateLimiter;
  clientRateLimiter: ClientAddressRateLimiter;
  maxConcurrentPerAccount: number;
  maxConcurrentPerClient: number;
}

export interface HistoricalImportRequestAdmissionInput {
  accountId: string;
  clientAddress: string;
  now?: Date | undefined;
}

export interface HistoricalImportRequestPermit {
  release(): void;
}

export type HistoricalImportRequestAdmissionDecision =
  | {
    allowed: true;
    permit: HistoricalImportRequestPermit;
  }
  | {
    allowed: false;
    reason: "rate_limited" | "concurrency_limited";
    retryAfterMs: number;
  };

export interface HistoricalImportRequestAdmission {
  acquire(input: HistoricalImportRequestAdmissionInput): HistoricalImportRequestAdmissionDecision;
}

const assertPositiveSafeInteger = (value: number, name: string): void => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer.`);
  }
};

const decrement = (counts: Map<string, number>, key: string): void => {
  const next = (counts.get(key) ?? 1) - 1;
  if (next <= 0) counts.delete(key);
  else counts.set(key, next);
};

export const createHistoricalImportRequestAdmission = (
  options: HistoricalImportRequestAdmissionOptions,
): HistoricalImportRequestAdmission => {
  assertPositiveSafeInteger(options.maxConcurrentPerAccount, "maxConcurrentPerAccount");
  assertPositiveSafeInteger(options.maxConcurrentPerClient, "maxConcurrentPerClient");

  const activeByAccount = new Map<string, number>();
  const activeByClient = new Map<string, number>();

  return {
    acquire: input => {
      const accountRateDecision = options.accountRateLimiter.consume(input.accountId, input.now);
      if (!accountRateDecision.allowed) {
        return {
          allowed: false,
          reason: "rate_limited",
          retryAfterMs: accountRateDecision.retryAfterMs,
        };
      }

      const clientRateDecision = options.clientRateLimiter.consume(input.clientAddress, input.now);
      if (!clientRateDecision.allowed) {
        return {
          allowed: false,
          reason: "rate_limited",
          retryAfterMs: clientRateDecision.retryAfterMs,
        };
      }

      if (
        (activeByAccount.get(input.accountId) ?? 0) >= options.maxConcurrentPerAccount ||
        (activeByClient.get(input.clientAddress) ?? 0) >= options.maxConcurrentPerClient
      ) {
        return {
          allowed: false,
          reason: "concurrency_limited",
          retryAfterMs: 1_000,
        };
      }

      activeByAccount.set(input.accountId, (activeByAccount.get(input.accountId) ?? 0) + 1);
      activeByClient.set(input.clientAddress, (activeByClient.get(input.clientAddress) ?? 0) + 1);
      let released = false;

      return {
        allowed: true,
        permit: {
          release: () => {
            if (released) return;
            released = true;
            decrement(activeByAccount, input.accountId);
            decrement(activeByClient, input.clientAddress);
          },
        },
      };
    },
  };
};
