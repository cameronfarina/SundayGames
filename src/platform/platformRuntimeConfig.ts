import { randomBytes } from "node:crypto";
import type { JobKind } from "./jobs.js";

export interface PlatformRuntimeEnv {
  readonly [key: string]: string | undefined;
}

export interface ReadPlatformRuntimeConfigOptions {
  requireDatabase?: boolean | undefined;
  requireDurableStore?: boolean | undefined;
  requireRunnableWorker?: boolean | undefined;
}

export interface PlatformRuntimeConfig {
  host: string;
  port: number;
  databaseUrl: string | undefined;
  dataFilePath: string | undefined;
  postgresPoolSize: number;
  postgresStatementTimeoutMs: number | undefined;
  postgresSnapshotKey: string | undefined;
  initializePostgresSchema: boolean;
  simulationDataMode: "disabled" | "local-fixtures";
  worker: {
    workerId: string;
    jobKinds: readonly JobKind[];
    pollIntervalMs: number;
    lockTtlMs: number;
  };
}

const defaultPostgresPoolSize = 5;
const defaultWorkerJobKinds: readonly JobKind[] = ["simulation"];
const defaultWorkerPollIntervalMs = 1_000;
const defaultWorkerLockTtlMs = 60_000;
const launchWorkerJobKinds = ["simulation"] as const satisfies readonly JobKind[];

const optionalEnvString = (env: PlatformRuntimeEnv, key: string): string | undefined => {
  const value = env[key]?.trim();

  return value === undefined || value.length === 0 ? undefined : value;
};

const positiveIntegerEnv = (
  env: PlatformRuntimeEnv,
  key: string,
  fallback: number,
): number => {
  const value = optionalEnvString(env, key);
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }

  return parsed;
};

const optionalPositiveIntegerEnv = (
  env: PlatformRuntimeEnv,
  key: string,
): number | undefined => {
  const value = optionalEnvString(env, key);
  if (value === undefined) return undefined;

  return positiveIntegerEnv(env, key, 1);
};

const booleanEnv = (
  env: PlatformRuntimeEnv,
  key: string,
  fallback = false,
): boolean => {
  const value = optionalEnvString(env, key);
  if (value === undefined) return fallback;

  switch (value.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
      return true;
    case "0":
    case "false":
    case "no":
      return false;
    default:
      throw new Error(`${key} must be true or false.`);
  }
};

const runtimeWorkerId = (env: PlatformRuntimeEnv): string =>
  optionalEnvString(env, "MOCKD_WORKER_ID") ??
  `worker_${randomBytes(8).toString("base64url")}`;

const simulationDataMode = (env: PlatformRuntimeEnv): PlatformRuntimeConfig["simulationDataMode"] => {
  const value = optionalEnvString(env, "MOCKD_SIMULATION_DATA_MODE") ?? "disabled";
  if (value === "disabled" || value === "local-fixtures") return value;

  throw new Error("MOCKD_SIMULATION_DATA_MODE must be disabled or local-fixtures.");
};

const workerJobKinds = (env: PlatformRuntimeEnv): readonly JobKind[] => {
  const value = optionalEnvString(env, "MOCKD_WORKER_JOB_KINDS");
  if (value === undefined) return defaultWorkerJobKinds;

  return value.split(",").map(rawKind => {
    const kind = rawKind.trim();
    const supportedKind = launchWorkerJobKinds.find(candidate => candidate === kind);
    if (supportedKind === undefined) {
      throw new Error(`MOCKD_WORKER_JOB_KINDS contains unsupported launch job kind "${kind}".`);
    }

    return supportedKind;
  });
};

export const readPlatformRuntimeConfig = (
  env: PlatformRuntimeEnv = process.env,
  options: ReadPlatformRuntimeConfigOptions = {},
): PlatformRuntimeConfig => {
  const databaseUrl = optionalEnvString(env, "DATABASE_URL") ?? optionalEnvString(env, "MOCKD_DATABASE_URL");
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
  ) {
    throw new Error("DATABASE_URL or MOCKD_PLATFORM_DATA_FILE is required.");
  }

  const parsedSimulationDataMode = simulationDataMode(env);
  const parsedWorkerJobKinds = workerJobKinds(env);
  if (
    options.requireRunnableWorker === true &&
    parsedWorkerJobKinds.includes("simulation") &&
    parsedSimulationDataMode !== "local-fixtures"
  ) {
    throw new Error("MOCKD_SIMULATION_DATA_MODE=local-fixtures is required when workers claim simulation jobs.");
  }

  return {
    host: optionalEnvString(env, "HOST") ?? "127.0.0.1",
    port: positiveIntegerEnv(env, "PORT", 0),
    databaseUrl,
    dataFilePath,
    postgresPoolSize: positiveIntegerEnv(env, "MOCKD_POSTGRES_POOL_SIZE", defaultPostgresPoolSize),
    postgresStatementTimeoutMs: optionalPositiveIntegerEnv(env, "MOCKD_POSTGRES_STATEMENT_TIMEOUT_MS"),
    postgresSnapshotKey: optionalEnvString(env, "MOCKD_POSTGRES_SNAPSHOT_KEY"),
    initializePostgresSchema: booleanEnv(env, "MOCKD_INITIALIZE_POSTGRES_SCHEMA"),
    simulationDataMode: parsedSimulationDataMode,
    worker: {
      workerId: runtimeWorkerId(env),
      jobKinds: parsedWorkerJobKinds,
      pollIntervalMs: positiveIntegerEnv(
        env,
        "MOCKD_WORKER_POLL_INTERVAL_MS",
        defaultWorkerPollIntervalMs,
      ),
      lockTtlMs: positiveIntegerEnv(env, "MOCKD_WORKER_LOCK_TTL_MS", defaultWorkerLockTtlMs),
    },
  };
};
