import { platformPostgresMigrationStatements } from "./postgresSchema.js";
import { PostgresPlatformStore, type PostgresQueryClient } from "./postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import { platformInvitationSchemaStatements } from "./postgresPlatformInvitations.js";

export interface ApplyPlatformPostgresMigrationsResult {
  statementCount: number;
}

interface AppliedMigrationRow {
  id: string;
}

const platformSchemaMigrationId = "platform-schema-v1";
const liveRoomPausedMigrationId = "platform-live-room-paused-v2";
const platformInvitationsMigrationId = "platform-invitations-v3";

interface PlatformSchemaMigration {
  id: string;
  statements: readonly string[];
}

const platformSchemaMigrations: readonly PlatformSchemaMigration[] = [
  {
    id: platformSchemaMigrationId,
    statements: platformPostgresMigrationStatements,
  },
  {
    id: liveRoomPausedMigrationId,
    statements: [
      "ALTER TABLE draft_rooms DROP CONSTRAINT IF EXISTS draft_rooms_status_check;",
      "ALTER TABLE draft_rooms ADD CONSTRAINT draft_rooms_status_check CHECK (status IN ('setup', 'countdown', 'live', 'paused', 'ended'));",
    ],
  },
  {
    id: platformInvitationsMigrationId,
    statements: platformInvitationSchemaStatements,
  },
];

export const requiredPlatformPostgresMigrationIds: readonly string[] =
  platformSchemaMigrations.map(migration => migration.id);

const createPlatformSchemaMigrationsTableSql = `
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

export const applyPlatformPostgresMigrations = async (
  client: PostgresTransactionalQueryClient,
): Promise<ApplyPlatformPostgresMigrationsResult> => {
  await PostgresPlatformStore.initializeSchema(client);
  await client.query(createPlatformSchemaMigrationsTableSql);

  return await client.transaction(async transactionClient => {
    let statementCount = 0;

    for (const migration of platformSchemaMigrations) {
      const existing = await transactionClient.query<AppliedMigrationRow>(
        "SELECT id FROM platform_schema_migrations WHERE id = $1",
        [migration.id],
      );
      if (existing.rows.length > 0) continue;

      for (const statement of migration.statements) {
        await transactionClient.query(statement);
      }
      await transactionClient.query(
        "INSERT INTO platform_schema_migrations (id) VALUES ($1)",
        [migration.id],
      );
      statementCount += migration.statements.length + 2;
    }

    return { statementCount };
  });
};
