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
  draftToolsSessionDirectory: string;
  allowPublicSignup: boolean;
  trustProxy: boolean;
  liveDraftDataMode: "postgres" | "local-fixtures";
  provisioningToken: string | undefined;
  simulationDataMode: "disabled" | "local-fixtures";
  worker: {
    workerId: string;
    jobKinds: readonly JobKind[];
    pollIntervalMs: number;
    lockTtlMs: number;
  };
}

export type PlatformProductionReadinessCheckStatus = "pass" | "fail";

export interface PlatformProductionReadinessCheck {
  status: PlatformProductionReadinessCheckStatus;
  label: string;
  detail: string;
}

type PlatformDatabaseUrlEnvKey = "DATABASE_URL" | "MOCKD_DATABASE_URL";

interface PlatformDatabaseUrlEnvValue {
  envKey: PlatformDatabaseUrlEnvKey;
  value: string;
}

export type PlatformProductionReadinessStorage =
  | { kind: "postgres"; envKey: PlatformDatabaseUrlEnvKey }
  | { kind: "file"; dataFilePath: string }
  | { kind: "ambiguous"; databaseEnvKey: PlatformDatabaseUrlEnvKey; dataFilePath: string }
  | { kind: "missing" };

export interface PlatformProductionReadinessReport {
  ready: boolean;
  host: string;
  port: number | undefined;
  storage: PlatformProductionReadinessStorage;
  checks: readonly PlatformProductionReadinessCheck[];
  nextSteps: readonly string[];
}

const defaultPostgresPoolSize = 5;
const defaultWorkerJobKinds: readonly JobKind[] = ["simulation"];
const defaultWorkerPollIntervalMs = 1_000;
const defaultWorkerLockTtlMs = 60_000;
const defaultDraftToolsSessionDirectory = "data/platform-draft-tools";
const launchWorkerJobKinds = ["simulation"] as const satisfies readonly JobKind[];
const productionReadinessNextSteps = [
  "Run `npm run platform:migrate` against the production DATABASE_URL before starting web or worker processes.",
  "Mount a persistent volume and set `MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY` to its draft-tools directory.",
  "Seed or verify production league, users, memberships, pricing, and a test live room; use `npm run platform:seed:e2e` only for rehearsal fixtures.",
  "Start `npm run platform:web` behind the domain/proxy and `npm run platform:worker` for background jobs.",
  "Run `npm run smoke` after deploy and keep the output with the release notes.",
] as const;

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

const liveDraftDataMode = (
  env: PlatformRuntimeEnv,
): PlatformRuntimeConfig["liveDraftDataMode"] => {
  const value = optionalEnvString(env, "MOCKD_LIVE_DRAFT_DATA_MODE") ?? "postgres";
  if (value !== "postgres" && value !== "local-fixtures") {
    throw new Error("MOCKD_LIVE_DRAFT_DATA_MODE must be postgres or local-fixtures.");
  }
  if (value === "local-fixtures" && optionalEnvString(env, "NODE_ENV") === "production") {
    throw new Error("MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is only supported outside production.");
  }

  return value;
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

const databaseUrlEnv = (
  env: PlatformRuntimeEnv,
): PlatformDatabaseUrlEnvValue | undefined => {
  const databaseUrl = optionalEnvString(env, "DATABASE_URL");
  if (databaseUrl !== undefined) return { envKey: "DATABASE_URL", value: databaseUrl };

  const mockdDatabaseUrl = optionalEnvString(env, "MOCKD_DATABASE_URL");
  if (mockdDatabaseUrl !== undefined) return { envKey: "MOCKD_DATABASE_URL", value: mockdDatabaseUrl };

  return undefined;
};

const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isPostgresDatabaseUrl = (databaseUrl: string): boolean => {
  try {
    const protocol = new URL(databaseUrl).protocol;

    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
};

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
    draftToolsSessionDirectory: optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") ?? defaultDraftToolsSessionDirectory,
    allowPublicSignup: booleanEnv(env, "MOCKD_ALLOW_PUBLIC_SIGNUP"),
    trustProxy: booleanEnv(env, "MOCKD_TRUST_PROXY"),
    liveDraftDataMode: parsedLiveDraftDataMode,
    provisioningToken: optionalEnvString(env, "MOCKD_PROVISIONING_TOKEN"),
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

export const readPlatformWebRuntimeConfig = (
  env: PlatformRuntimeEnv = process.env,
): PlatformRuntimeConfig => {
  const config = readPlatformRuntimeConfig(env, { requireDurableStore: true });
  if (config.databaseUrl !== undefined && !isPostgresDatabaseUrl(config.databaseUrl)) {
    throw new Error("DATABASE_URL must be a postgres:// or postgresql:// connection string.");
  }
  if (config.liveDraftDataMode !== "local-fixtures" && config.databaseUrl === undefined) {
    throw new Error(
      "DATABASE_URL is required unless MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is set outside production.",
    );
  }
  if (
    config.liveDraftDataMode !== "local-fixtures" &&
    optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") === undefined
  ) {
    throw new Error(
      "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is required for Postgres-backed web startup.",
    );
  }

  return config;
};

const productionReadinessStorage = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessStorage => {
  const database = databaseUrlEnv(env);
  const dataFilePath = optionalEnvString(env, "MOCKD_PLATFORM_DATA_FILE");

  if (database !== undefined && dataFilePath !== undefined) {
    return {
      kind: "ambiguous",
      databaseEnvKey: database.envKey,
      dataFilePath,
    };
  }
  if (database !== undefined) return { kind: "postgres", envKey: database.envKey };
  if (dataFilePath !== undefined) return { kind: "file", dataFilePath };

  return { kind: "missing" };
};

export const assessPlatformProductionReadiness = (
  env: PlatformRuntimeEnv = process.env,
): PlatformProductionReadinessReport => {
  const checks: PlatformProductionReadinessCheck[] = [];
  const storage = productionReadinessStorage(env);
  const database = databaseUrlEnv(env);
  const databaseUsesPostgresScheme = database !== undefined &&
    isPostgresDatabaseUrl(database.value);
  const host = optionalEnvString(env, "HOST") ?? "127.0.0.1";
  let port: number | undefined;

  if (database === undefined) {
    checks.push({
      status: "fail",
      label: "Postgres durable storage",
      detail: "DATABASE_URL is required for production/domain readiness.",
    });
  } else if (!databaseUsesPostgresScheme) {
    checks.push({
      status: "fail",
      label: "Postgres durable storage",
      detail: `${database.envKey} must be a postgres:// or postgresql:// connection string.`,
    });
  } else {
    checks.push({
      status: "pass",
      label: "Postgres durable storage",
      detail: `${database.envKey} is configured for durable platform storage.`,
    });
  }

  if (storage.kind === "file" || storage.kind === "ambiguous") {
    checks.push({
      status: "fail",
      label: "File-backed storage",
      detail: "MOCKD_PLATFORM_DATA_FILE is local-only and cannot be used for production/domain deployment.",
    });
  } else {
    checks.push({
      status: "pass",
      label: "File-backed storage",
      detail: "MOCKD_PLATFORM_DATA_FILE is not configured.",
    });
  }

  if (booleanEnv(env, "MOCKD_ALLOW_PUBLIC_SIGNUP")) {
    checks.push({
      status: "fail",
      label: "Invite-only signup",
      detail: "MOCKD_ALLOW_PUBLIC_SIGNUP must be unset or false in production.",
    });
  } else {
    checks.push({
      status: "pass",
      label: "Invite-only signup",
      detail: "Public account creation is restricted to valid league invitations.",
    });
  }

  const configuredLiveDraftDataMode = optionalEnvString(env, "MOCKD_LIVE_DRAFT_DATA_MODE") ?? "postgres";
  if (configuredLiveDraftDataMode === "postgres") {
    checks.push({
      status: "pass",
      label: "Live draft data",
      detail: "Live draft data is configured for Postgres.",
    });
  } else if (configuredLiveDraftDataMode === "local-fixtures") {
    checks.push({
      status: "fail",
      label: "Live draft data",
      detail: "MOCKD_LIVE_DRAFT_DATA_MODE=local-fixtures is local-only.",
    });
  } else {
    checks.push({
      status: "fail",
      label: "Live draft data",
      detail: "MOCKD_LIVE_DRAFT_DATA_MODE must be postgres for production/domain readiness.",
    });
  }

  if (optionalEnvString(env, "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY") === undefined) {
    checks.push({
      status: "fail",
      label: "Private draft storage",
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY must point to a persistent volume.",
    });
  } else {
    checks.push({
      status: "pass",
      label: "Private draft storage",
      detail: "MOCKD_DRAFT_TOOLS_SESSION_DIRECTORY is configured.",
    });
  }

  if (optionalEnvString(env, "PORT") === undefined) {
    checks.push({
      status: "fail",
      label: "Web bind target",
      detail: "PORT is required for production/domain readiness.",
    });
  } else {
    try {
      port = positiveIntegerEnv(env, "PORT", 0);
      checks.push({
        status: "pass",
        label: "Web bind target",
        detail: `Host ${host}, port ${port}.`,
      });
    } catch (error) {
      checks.push({
        status: "fail",
        label: "Web bind target",
        detail: errorMessage(error),
      });
    }
  }

  if (storage.kind === "postgres" && databaseUsesPostgresScheme && port !== undefined) {
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
    port,
    storage,
    checks,
    nextSteps: productionReadinessNextSteps,
  };
};

const storageDescription = (storage: PlatformProductionReadinessStorage): string => {
  switch (storage.kind) {
    case "postgres":
      return `Postgres (${storage.envKey})`;
    case "file":
      return `File-backed local store (${storage.dataFilePath})`;
    case "ambiguous":
      return `Postgres (${storage.databaseEnvKey}) plus file-backed local store (${storage.dataFilePath})`;
    case "missing":
      return "Missing";
  }
};

export const formatPlatformProductionReadinessReport = (
  report: PlatformProductionReadinessReport,
): string => {
  const status = report.ready ? "READY" : "BLOCKED";
  const bindTarget = report.port === undefined ? `${report.host}:<missing PORT>` : `${report.host}:${report.port}`;

  return [
    `Mockd production/domain readiness: ${status}`,
    `Storage: ${storageDescription(report.storage)}`,
    `Web bind: ${bindTarget}`,
    "",
    "Checks:",
    ...report.checks.map(check => `${check.status.toUpperCase()} ${check.label} - ${check.detail}`),
    "",
    "Next steps:",
    ...report.nextSteps.map((step, index) => `${index + 1}. ${step}`),
  ].join("\n");
};

export const platformProductionReadinessExitCode = (
  report: Pick<PlatformProductionReadinessReport, "ready">,
): 0 | 1 => report.ready ? 0 : 1;
