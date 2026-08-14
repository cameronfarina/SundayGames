import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
  type ClientAddressRateLimiter,
  type NormalizedEmailRateLimiter,
} from "../authRateLimit.js";
import { createHistoricalImportRequestAdmission } from "../historicalImportRequestAdmission.js";
import type { CreatePlatformServerOptions } from "./contracts.js";

export interface PlatformAdmissions {
  accountRateLimiter: NormalizedEmailRateLimiter;
  loginRateLimiter: NormalizedEmailRateLimiter;
  verificationRateLimiter: NormalizedEmailRateLimiter;
  passwordResetRateLimiter: NormalizedEmailRateLimiter;
  passwordResetConsumeRateLimiter: ClientAddressRateLimiter;
  authClientRateLimiter: ClientAddressRateLimiter;
  screenshotImportRateLimiter: ClientAddressRateLimiter;
  screenshotImportIngressRateLimiter: ClientAddressRateLimiter;
  historicalImportRequestAdmission: ReturnType<typeof createHistoricalImportRequestAdmission>;
  leagueImportRateLimiter: ClientAddressRateLimiter;
  simulationRateLimiter: ClientAddressRateLimiter;
  liveDraftMutationRateLimiter: ClientAddressRateLimiter;
}

const emailLimiter = (maxAttempts: number, windowMs: number): NormalizedEmailRateLimiter =>
  createNormalizedEmailRateLimiter({ maxAttempts, windowMs, maxTrackedEmails: 10_000 });

const clientLimiter = (maxAttempts: number, windowMs: number): ClientAddressRateLimiter =>
  createClientAddressRateLimiter({ maxAttempts, windowMs, maxTrackedEmails: 10_000 });

export const createPlatformAdmissions = (
  options: CreatePlatformServerOptions,
): PlatformAdmissions => ({
  accountRateLimiter: options.accountRateLimiter ?? emailLimiter(5, 15 * 60 * 1_000),
  loginRateLimiter: options.loginRateLimiter ?? emailLimiter(5, 15 * 60 * 1_000),
  verificationRateLimiter: options.verificationRateLimiter ?? emailLimiter(3, 60 * 60 * 1_000),
  passwordResetRateLimiter: options.passwordResetRateLimiter ?? emailLimiter(3, 60 * 60 * 1_000),
  passwordResetConsumeRateLimiter: options.passwordResetConsumeRateLimiter ??
    clientLimiter(5, 15 * 60 * 1_000),
  authClientRateLimiter: options.authClientRateLimiter ?? clientLimiter(120, 15 * 60 * 1_000),
  screenshotImportRateLimiter: options.screenshotImportRateLimiter ??
    clientLimiter(5, 60 * 60 * 1_000),
  screenshotImportIngressRateLimiter: options.screenshotImportIngressRateLimiter ??
    clientLimiter(5, 60 * 60 * 1_000),
  historicalImportRequestAdmission: createHistoricalImportRequestAdmission({
    accountRateLimiter: options.historicalImportAccountRateLimiter ??
      clientLimiter(30, 60 * 60 * 1_000),
    clientRateLimiter: options.historicalImportClientRateLimiter ??
      clientLimiter(60, 60 * 60 * 1_000),
    maxConcurrentPerAccount: options.historicalImportMaxConcurrentPerAccount ?? 2,
    maxConcurrentPerClient: options.historicalImportMaxConcurrentPerClient ?? 4,
  }),
  leagueImportRateLimiter: options.leagueImportRateLimiter ?? clientLimiter(10, 15 * 60 * 1_000),
  simulationRateLimiter: options.simulationRateLimiter ?? clientLimiter(10, 15 * 60 * 1_000),
  liveDraftMutationRateLimiter: options.liveDraftMutationRateLimiter ?? clientLimiter(30, 60 * 1_000),
});
