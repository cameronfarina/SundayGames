import type { MockBatchResourceLimits } from "./contracts.js";

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return value;
};

export const validatedLimits = (
  limits: MockBatchResourceLimits,
): MockBatchResourceLimits => ({
  maxRunningGlobal: positiveInteger(limits.maxRunningGlobal, "maxRunningGlobal"),
  maxRunningPerAccount: positiveInteger(limits.maxRunningPerAccount, "maxRunningPerAccount"),
  maxRunningPerSeason: positiveInteger(limits.maxRunningPerSeason, "maxRunningPerSeason"),
  maxQueuedGlobal: positiveInteger(limits.maxQueuedGlobal, "maxQueuedGlobal"),
  maxQueuedPerAccount: positiveInteger(limits.maxQueuedPerAccount, "maxQueuedPerAccount"),
  maxQueuedPerSeason: positiveInteger(limits.maxQueuedPerSeason, "maxQueuedPerSeason"),
  retryAfterSeconds: positiveInteger(limits.retryAfterSeconds, "retryAfterSeconds"),
});
