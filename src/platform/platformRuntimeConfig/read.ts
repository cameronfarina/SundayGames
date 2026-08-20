import { authEmailConfig } from "./authEmail.js";
import type {
  PlatformRuntimeConfig,
  PlatformRuntimeEnv,
  ReadPlatformRuntimeConfigOptions,
} from "./contracts.js";
import { databaseUrlEnv } from "./database.js";
import { leagueConnectionCredentialCipherFromEnv } from "./credentialEncryption.js";
import {
  defaultDraftToolsSessionDirectory,
  defaultPostgresPoolSize,
  defaultWorkerLockTtlMs,
  defaultWorkerPollIntervalMs,
} from "./defaults.js";
import {
  booleanEnv,
  optionalEnvString,
  optionalPositiveIntegerEnv,
  positiveIntegerEnv,
} from "./env.js";
import {
  fantasyProsConfig,
  playerNewsConfig,
  legacyMockBatchEnabled,
  liveDraftDataMode,
  runtimeWorkerId,
  screenshotImportConfig,
  simulationDataMode,
  workerJobKinds,
} from "./modes.js";

export const readPlatformRuntimeConfig = (
  env: PlatformRuntimeEnv = process.env,
  options: ReadPlatformRuntimeConfigOptions = {},
): PlatformRuntimeConfig => {
  const parsedLiveDraftDataMode = liveDraftDataMode(env);
  const databaseUrl = databaseUrlEnv(env)?.value;
  const dataFilePath = optionalEnvString(env, "MOCKD_PLATFORM_DATA_FILE");
  if (databaseUrl !== undefined && dataFilePath !== undefined) {
    throw new Error("Configure either DATABASE_URL or MOCKD_PLATFORM_DATA_FILE, not both.");
  }
  if (options.requireDatabase === true && databaseUrl === undefined) {
    throw new Error("DATABASE_URL is required.");
  }
  if (
    options.requireDurableStore === true &&
    databaseUrl === undefined &&
    dataFilePath === undefined
  ) throw new Error("DATABASE_URL or MOCKD_PLATFORM_DATA_FILE is required.");
  const parsedSimulationDataMode = simulationDataMode(env);
  const parsedWorkerJobKinds = workerJobKinds(env);
  if (
    options.requireRunnableWorker === true &&
    parsedWorkerJobKinds.includes("simulation") &&
    parsedSimulationDataMode !== "local-fixtures"
  ) {
    throw new Error(
      "MOCKD_SIMULATION_DATA_MODE=local-fixtures is required when workers claim simulation jobs.",
    );
  }
  return {
    host: optionalEnvString(env, "HOST") ?? "127.0.0.1",
    port: positiveIntegerEnv(env, "PORT", 0),
    databaseUrl,
    dataFilePath,
    postgresPoolSize: positiveIntegerEnv(
      env,
      "MOCKD_POSTGRES_POOL_SIZE",
      defaultPostgresPoolSize,
    ),
    postgresStatementTimeoutMs: optionalPositiveIntegerEnv(
      env,
      "MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS",
    ),
    postgresSnapshotKey: optionalEnvString(env, "MOCKD_POSTGRES_SNAPSHOT_KEY"),
    initializePostgresSchema: booleanEnv(env, "MOCKD_INITIALIZE_POSTGRES_SCHEMA"),
    draftToolsSessionDirectory:
      optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") ??
      defaultDraftToolsSessionDirectory,
    legacyMockBatchEnabled: legacyMockBatchEnabled(env),
    allowPublicSignup: booleanEnv(env, "MOCKD_ALLOW_PUBLIC_SIGNUP"),
    trustProxy: booleanEnv(env, "MOCKD_TRUST_PROXY"),
    liveDraftDataMode: parsedLiveDraftDataMode,
    provisioningToken: optionalEnvString(env, "MOCKD_PROVISIONING_TOKEN"),
    invitationTokenSecret: optionalEnvString(env, "MOCKD_INVITATION_TOKEN_SECRET"),
    leagueConnectionCredentialCipher: leagueConnectionCredentialCipherFromEnv(env),
    authEmail: authEmailConfig(env),
    simulationDataMode: parsedSimulationDataMode,
    screenshotImport: screenshotImportConfig(env),
    fantasyPros: fantasyProsConfig(env),
    playerNews: playerNewsConfig(env),
    worker: {
      workerId: runtimeWorkerId(env),
      jobKinds: parsedWorkerJobKinds,
      pollIntervalMs: positiveIntegerEnv(
        env,
        "MOCKD_WORKER_POLL_INTERVAL_MS",
        defaultWorkerPollIntervalMs,
      ),
      lockTtlMs: positiveIntegerEnv(
        env,
        "MOCKD_WORKER_LOCK_TTL_MS",
        defaultWorkerLockTtlMs,
      ),
    },
  };
};
