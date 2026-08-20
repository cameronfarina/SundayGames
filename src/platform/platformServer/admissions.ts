import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
  type AuthAttemptRateLimiter,
  type ClientAddressRateLimiter,
  type NormalizedEmailRateLimiter,
} from "../authRateLimit.js";
import { normalizeEmail } from "../auth.js";
import { createHistoricalImportRequestAdmission } from "../historicalImportRequestAdmission.js";
import { PostgresAuthRateLimiter } from "../postgresAuthRateLimit.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import { isTransactionalPostgresClient } from "./postgres.js";

export interface PlatformAdmissions {
  accountRateLimiter: AuthAttemptRateLimiter;
  loginRateLimiter: AuthAttemptRateLimiter;
  verificationRateLimiter: AuthAttemptRateLimiter;
  passwordResetRateLimiter: AuthAttemptRateLimiter;
  passwordResetConsumeRateLimiter: AuthAttemptRateLimiter;
  authClientRateLimiter: AuthAttemptRateLimiter;
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

const sharedAuthRateLimitClient = (
  options: CreatePlatformServerOptions,
): PostgresTransactionalQueryClient | undefined => {
  const candidates = [options.postgresAuthClient, options.postgresClient];
  for (const candidate of candidates) {
    if (candidate !== undefined && isTransactionalPostgresClient(candidate)) return candidate;
  }
  return undefined;
};

const postgresLimiter = (
  client: PostgresTransactionalQueryClient | undefined,
  scope: string,
  maxAttempts: number,
  windowMs: number,
  normalizeKey: (key: string) => string,
): AuthAttemptRateLimiter | undefined => client === undefined ? undefined : new PostgresAuthRateLimiter(client, {
  scope,
  maxAttempts,
  windowMs,
  maxTrackedKeys: 10_000,
  cleanupBatchSize: 100,
  normalizeKey,
});

const normalizeClientAddress = (value: string): string => value.trim().toLowerCase() || "unknown";

export const createPlatformAdmissions = (
  options: CreatePlatformServerOptions,
): PlatformAdmissions => {
  const postgresClient = sharedAuthRateLimitClient(options);
  return {
    accountRateLimiter: options.accountRateLimiter ??
      postgresLimiter(postgresClient, "account-email", 5, 15 * 60 * 1_000, normalizeEmail) ??
      emailLimiter(5, 15 * 60 * 1_000),
    loginRateLimiter: options.loginRateLimiter ??
      postgresLimiter(postgresClient, "login-client", 5, 15 * 60 * 1_000, normalizeClientAddress) ??
      clientLimiter(5, 15 * 60 * 1_000),
    verificationRateLimiter: options.verificationRateLimiter ??
      postgresLimiter(postgresClient, "verification-email", 3, 60 * 60 * 1_000, normalizeEmail) ??
      emailLimiter(3, 60 * 60 * 1_000),
    passwordResetRateLimiter: options.passwordResetRateLimiter ??
      postgresLimiter(postgresClient, "password-reset-email", 3, 60 * 60 * 1_000, normalizeEmail) ??
      emailLimiter(3, 60 * 60 * 1_000),
    passwordResetConsumeRateLimiter: options.passwordResetConsumeRateLimiter ??
      postgresLimiter(postgresClient, "password-reset-client", 5, 15 * 60 * 1_000, normalizeClientAddress) ??
      clientLimiter(5, 15 * 60 * 1_000),
    authClientRateLimiter: options.authClientRateLimiter ??
      postgresLimiter(postgresClient, "auth-client", 120, 15 * 60 * 1_000, normalizeClientAddress) ??
      clientLimiter(120, 15 * 60 * 1_000),
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
  };
};
