import { platformPostgresMigrationStatements } from "./postgresSchema.js";
import { PostgresPlatformStore, type PostgresQueryClient } from "./postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";

export interface ApplyPlatformPostgresMigrationsResult {
  statementCount: number;
}

interface AppliedMigrationRow {
  id: string;
}

const platformSchemaMigrationId = "platform-schema-v1";

const createPlatformSchemaMigrationsTableSql = `
CREATE TABLE IF NOT EXISTS platform_schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

export const applyPlatformPostgresMigrations = async (
  client: PostgresTransactionalQueryClient,
): Promise<ApplyPlatformPostgresMigrationsResult> => {
  await PostgresPlatformStore.initializeSchema(client);
  await client.query(createPlatformSchemaMigrationsTableSql);

  return await client.transaction(async transactionClient => {
    const existing = await transactionClient.query<AppliedMigrationRow>(
      "SELECT id FROM platform_schema_migrations WHERE id = $1",
      [platformSchemaMigrationId],
    );

    if (existing.rows.length > 0) return { statementCount: 0 };

    for (const statement of platformPostgresMigrationStatements) {
      await transactionClient.query(statement);
    }
    await transactionClient.query(
      "INSERT INTO platform_schema_migrations (id) VALUES ($1)",
      [platformSchemaMigrationId],
    );

    return { statementCount: platformPostgresMigrationStatements.length + 2 };
  });
};
