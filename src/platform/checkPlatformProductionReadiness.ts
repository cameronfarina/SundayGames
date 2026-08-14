import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assessPlatformProductionReadiness,
  formatPlatformProductionReadinessReport,
  platformProductionReadinessExitCode,
  readPlatformRuntimeConfig,
  type PlatformProductionReadinessCheck,
  type PlatformProductionReadinessReport,
} from "./platformRuntimeConfig.js";
import { findMissingPlatformPostgresMigrations } from "./platformMigrations.js";
import { createNodePostgresClient } from "./postgresClient.js";
import type { PostgresQueryClient } from "./postgresPlatformStore.js";

export type PlatformDatabaseReadiness =
  | { status: "ready" }
  | { status: "unreachable" }
  | { status: "migration_check_failed" }
  | { status: "migrations_missing"; missingMigrationIds: readonly string[] };

export type PlatformDatabaseReadinessProbe = (
  databaseUrl: string,
) => Promise<PlatformDatabaseReadiness>;

export type PlatformDraftStorageReadinessProbe = (directory: string) => Promise<void>;

export interface PlatformProductionReadinessProbes {
  probeDatabase?: PlatformDatabaseReadinessProbe | undefined;
  probeDraftStorage?: PlatformDraftStorageReadinessProbe | undefined;
}

export const inspectPlatformPostgresReadiness = async (
  client: PostgresQueryClient,
): Promise<PlatformDatabaseReadiness> => {
  try {
    await client.query("SELECT 1");
  } catch {
    return { status: "unreachable" };
  }

  try {
    const missingMigrationIds = await findMissingPlatformPostgresMigrations(client);

    return missingMigrationIds.length === 0
      ? { status: "ready" }
      : { status: "migrations_missing", missingMigrationIds };
  } catch {
    return { status: "migration_check_failed" };
  }
};

const probePlatformDatabase: PlatformDatabaseReadinessProbe = async databaseUrl => {
  const client = createNodePostgresClient({ databaseUrl, max: 1, statementTimeoutMs: 5_000 });

  try {
    return await inspectPlatformPostgresReadiness(client);
  } finally {
    await client.close();
  }
};

export const probeWritableDraftToolsDirectory: PlatformDraftStorageReadinessProbe = async directory => {
  await mkdir(directory, { recursive: true });
  const probePath = join(directory, `.mockd-readiness-${randomUUID()}`);
  let probeFile: Awaited<ReturnType<typeof open>> | undefined;

  try {
    probeFile = await open(probePath, "wx", 0o600);
    await probeFile.writeFile("mockd readiness probe\n", "utf8");
    await probeFile.sync();
  } finally {
    try {
      await probeFile?.close();
    } finally {
      if (probeFile !== undefined) await rm(probePath, { force: true });
    }
  }
};

const databaseChecksFor = (
  result: PlatformDatabaseReadiness,
): PlatformProductionReadinessReport["checks"] => {
  if (result.status === "unreachable") {
    return [{
      status: "fail",
      label: "Postgres connectivity",
      detail: "Could not connect to the configured Postgres database.",
    }];
  }

  const connectivityCheck: PlatformProductionReadinessCheck = {
    status: "pass",
    label: "Postgres connectivity",
    detail: "Connected to the configured Postgres database.",
  };
  if (result.status === "migration_check_failed") {
    return [connectivityCheck, {
      status: "fail",
      label: "Postgres migrations",
      detail: "Could not verify the platform migration ledger.",
    }];
  }
  if (result.status === "migrations_missing") {
    return [connectivityCheck, {
      status: "fail",
      label: "Postgres migrations",
      detail: `Missing required migrations: ${result.missingMigrationIds.join(", ")}.`,
    }];
  }

  return [connectivityCheck, {
    status: "pass",
    label: "Postgres migrations",
    detail: "All required platform migrations are applied.",
  }];
};

export const checkPlatformProductionReadinessFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  probes: PlatformProductionReadinessProbes = {},
): Promise<PlatformProductionReadinessReport> => {
  const report = assessPlatformProductionReadiness(env);
  if (!report.ready) return report;

  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) return report;
  const probeDatabase = probes.probeDatabase ?? probePlatformDatabase;
  const probeDraftStorage = probes.probeDraftStorage ?? probeWritableDraftToolsDirectory;
  const [databaseReadiness, draftStorageWritable] = await Promise.all([
    probeDatabase(databaseUrl).catch((): PlatformDatabaseReadiness => ({ status: "unreachable" })),
    probeDraftStorage(config.draftToolsSessionDirectory).then(
      () => true,
      () => false,
    ),
  ]);
  const draftStorageCheck: PlatformProductionReadinessCheck = draftStorageWritable
    ? {
        status: "pass",
        label: "Private draft storage write access",
        detail: "The configured private draft storage directory passed a write and delete probe.",
      }
    : {
        status: "fail",
        label: "Private draft storage write access",
        detail: "Could not write to and clean up the configured private draft storage directory.",
      };
  const checks = [
    ...report.checks,
    ...databaseChecksFor(databaseReadiness),
    draftStorageCheck,
  ];

  return {
    ...report,
    ready: checks.every(check => check.status === "pass"),
    checks,
  };
};

const run = async (): Promise<void> => {
  const report = await checkPlatformProductionReadinessFromEnv();
  console.log(formatPlatformProductionReadinessReport(report));
  process.exitCode = platformProductionReadinessExitCode(report);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
