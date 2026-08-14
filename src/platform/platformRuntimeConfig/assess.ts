import type {
  PlatformProductionReadinessCheck,
  PlatformProductionReadinessReport,
  PlatformRuntimeEnv,
} from "./contracts.js";
import {
  databaseUrlEnv,
  isPostgresDatabaseUrl,
  productionReadinessStorage,
} from "./database.js";
import { productionReadinessNextSteps } from "./defaults.js";
import { errorMessage, optionalEnvString } from "./env.js";
import { accountCheck, emailCheck, invitationCheck, storageChecks } from "./coreChecks.js";
import { readPlatformRuntimeConfig } from "./read.js";
import {
  bindCheck,
  liveDraftCheck,
  privateStorageCheck,
  screenshotCheck,
} from "./serviceChecks.js";

export const assessPlatformProductionReadiness = (
  env: PlatformRuntimeEnv = process.env,
): PlatformProductionReadinessReport => {
  const storage = productionReadinessStorage(env);
  const database = databaseUrlEnv(env);
  const databaseUsesPostgresScheme = database !== undefined &&
    isPostgresDatabaseUrl(database.value);
  const host = optionalEnvString(env, "HOST") ?? "127.0.0.1";
  const bind = bindCheck(env, host);
  const checks: PlatformProductionReadinessCheck[] = [
    ...storageChecks(env, storage),
    accountCheck(env),
    emailCheck(env),
    invitationCheck(env),
    liveDraftCheck(env),
    privateStorageCheck(env),
    bind.check,
    screenshotCheck(env),
  ];
  if (storage.kind === "postgres" && databaseUsesPostgresScheme && bind.port !== undefined) {
    try {
      readPlatformRuntimeConfig(env, { requireDatabase: true });
    } catch (error) {
      checks.push({
        status: "fail",
        label: "Runtime configuration",
        detail: errorMessage(error),
      });
    }
  }
  return {
    ready: checks.every(check => check.status === "pass"),
    host,
    port: bind.port,
    storage,
    checks,
    nextSteps: productionReadinessNextSteps,
  };
};
