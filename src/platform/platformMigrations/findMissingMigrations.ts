import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { AppliedMigrationRow } from "./contracts.js";
import { requiredPlatformPostgresMigrationIds } from "./definitions.js";

export const createPlatformSchemaMigrationsTableSql = `
CREATE TABLE IF NOT EXISTS platform_schema_migrations (
  id text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now()
);
`.trim();

export const findMissingPlatformPostgresMigrations = async (
  client: PostgresQueryClient,
): Promise<readonly string[]> => {
  const missingMigrationIds: string[] = [];

  for (const migrationId of requiredPlatformPostgresMigrationIds) {
    const existing = await client.query<AppliedMigrationRow>(
      "SELECT id FROM platform_schema_migrations WHERE id = $1",
      [migrationId],
    );
    if (existing.rows.length === 0) missingMigrationIds.push(migrationId);
  }

  return missingMigrationIds;
};
