import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import {
  PostgresPlatformStore,
  type PostgresQueryClient,
} from "../postgresPlatformStore.js";
import type {
  AppliedMigrationRow,
  ApplyPlatformPostgresMigrationsResult,
  PlatformSchemaMigration,
} from "./contracts.js";
import { platformSchemaMigrations } from "./definitions.js";
import { createPlatformSchemaMigrationsTableSql } from "./findMissingMigrations.js";
import { platformMigrationAdvisoryLockKeys } from "./ids.js";

const applyMigration = async (
  client: PostgresQueryClient,
  migration: PlatformSchemaMigration,
): Promise<number> => {
  const existing = await client.query<AppliedMigrationRow>(
    "SELECT id FROM platform_schema_migrations WHERE id = $1",
    [migration.id],
  );
  if (existing.rows.length > 0) return 0;

  if (migration.preflight !== undefined) await migration.preflight(client);
  for (const statement of migration.statements) await client.query(statement);
  await client.query(
    "INSERT INTO platform_schema_migrations (id) VALUES ($1)",
    [migration.id],
  );
  return migration.statements.length + 2 + (migration.preflight === undefined ? 0 : 1);
};

export const applyPlatformPostgresMigrations = async (
  client: PostgresTransactionalQueryClient,
): Promise<ApplyPlatformPostgresMigrationsResult> => {
  return await client.transaction(async transactionClient => {
    await transactionClient.query(
      "SELECT pg_advisory_xact_lock($1, $2)",
      platformMigrationAdvisoryLockKeys,
    );
    await PostgresPlatformStore.initializeSchema(transactionClient);
    await transactionClient.query(createPlatformSchemaMigrationsTableSql);
    let statementCount = 0;

    for (const migration of platformSchemaMigrations) {
      statementCount += await applyMigration(transactionClient, migration);
    }
    return { statementCount };
  });
};
