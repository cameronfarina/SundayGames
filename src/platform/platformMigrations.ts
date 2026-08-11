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

interface DuplicateRealDraftRoomsRow {
  league_season_id: string;
  room_ids: string[];
}

const platformSchemaMigrationId = "platform-schema-v1";
const liveRoomPausedMigrationId = "platform-live-room-paused-v2";
const platformInvitationsMigrationId = "platform-invitations-v3";
const liveRoomSetupMigrationId = "platform-live-room-setup-v4";

const migrationStatementStartingWith = (prefix: string): string => {
  const statement = platformPostgresMigrationStatements.find(candidate =>
    candidate.startsWith(prefix)
  );
  if (statement === undefined) {
    throw new Error(`Missing platform schema statement for ${prefix}.`);
  }

  return statement;
};

const liveRoomSetupMigrationStatements = [
  migrationStatementStartingWith("CREATE TABLE league_season_draft_setups")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE UNIQUE INDEX draft_rooms_real_season_key")
    .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS"),
] as const;

interface PlatformSchemaMigration {
  id: string;
  statements: readonly string[];
  preflight?: (client: PostgresQueryClient) => Promise<void>;
}

const assertNoDuplicateRealDraftRooms = async (
  client: PostgresQueryClient,
): Promise<void> => {
  const result = await client.query<DuplicateRealDraftRoomsRow>(`
SELECT
  league_season_id,
  array_agg(id ORDER BY created_at ASC, id ASC) AS room_ids
FROM draft_rooms
WHERE room_type = 'real'
GROUP BY league_season_id
HAVING COUNT(*) > 1
ORDER BY league_season_id ASC;
`.trim());
  if (result.rows.length === 0) return;

  const duplicates = result.rows
    .map(row => `${row.league_season_id} (${row.room_ids.join(", ")})`)
    .join("; ");
  throw new Error(
    `Cannot apply ${liveRoomSetupMigrationId}: multiple real draft rooms exist for the same season: ${duplicates}. `
    + "Preserve the authoritative room and remove or reclassify the duplicate rooms, then rerun the migration.",
  );
};

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
  {
    id: liveRoomSetupMigrationId,
    statements: liveRoomSetupMigrationStatements,
    preflight: assertNoDuplicateRealDraftRooms,
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

      await migration.preflight?.(transactionClient);
      for (const statement of migration.statements) {
        await transactionClient.query(statement);
      }
      await transactionClient.query(
        "INSERT INTO platform_schema_migrations (id) VALUES ($1)",
        [migration.id],
      );
      statementCount += migration.statements.length + 2 + (migration.preflight === undefined ? 0 : 1);
    }

    return { statementCount };
  });
};
