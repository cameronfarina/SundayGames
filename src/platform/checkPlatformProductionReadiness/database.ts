import {
  type PlatformProductionReadinessCheck,
  type PlatformProductionReadinessReport,
} from "../platformRuntimeConfig.js";
import { findMissingPlatformPostgresMigrations } from "../platformMigrations.js";
import { createNodePostgresClient } from "../postgresClient.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type {
  PlatformDatabaseReadiness,
  PlatformDatabaseReadinessProbe,
} from "./contracts.js";

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

export const probePlatformDatabase: PlatformDatabaseReadinessProbe = async databaseUrl => {
  const client = createNodePostgresClient({
    databaseUrl,
    max: 1,
    statementTimeoutMs: 5_000,
  });
  try {
    return await inspectPlatformPostgresReadiness(client);
  } finally {
    await client.close();
  }
};

export const databaseChecksFor = (
  result: PlatformDatabaseReadiness,
): PlatformProductionReadinessReport["checks"] => {
  if (result.status === "unreachable") {
    return [{
      status: "fail",
      label: "Postgres connectivity",
      detail: "Could not connect to the configured Postgres database.",
    }];
  }
  const connectivity: PlatformProductionReadinessCheck = {
    status: "pass",
    label: "Postgres connectivity",
    detail: "Connected to the configured Postgres database.",
  };
  if (result.status === "migration_check_failed") {
    return [connectivity, {
      status: "fail",
      label: "Postgres migrations",
      detail: "Could not verify the platform migration ledger.",
    }];
  }
  if (result.status === "migrations_missing") {
    return [connectivity, {
      status: "fail",
      label: "Postgres migrations",
      detail: `Missing required migrations: ${result.missingMigrationIds.join(", ")}.`,
    }];
  }
  return [connectivity, {
    status: "pass",
    label: "Postgres migrations",
    detail: "All required platform migrations are applied.",
  }];
};
