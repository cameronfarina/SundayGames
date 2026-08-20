import type { PlatformSchemaMigration } from "./contracts.js";
import { corePlatformSchemaMigrations } from "./coreDefinitions.js";
import {
  authRateLimitsMigrationId,
  leagueCredentialEncryptionMigrationId,
  leagueSyncRevisionMigrationId,
  liveDraftScaleMigrationId,
  snakeLiveRoomMigrationId,
} from "./ids.js";
import { ownershipPlatformSchemaMigrations } from "./ownershipDefinitions.js";
import {
  authRateLimitMigrationStatements,
  leagueCredentialEncryptionMigrationStatements,
  leagueSyncRevisionMigrationStatements,
  liveDraftScaleMigrationStatements,
} from "./schemaStatements.js";

export const platformSchemaMigrations: readonly PlatformSchemaMigration[] = [
  ...corePlatformSchemaMigrations,
  ...ownershipPlatformSchemaMigrations,
  {
    id: snakeLiveRoomMigrationId,
    statements: [
      "ALTER TABLE draft_room_sales ALTER COLUMN price DROP NOT NULL;",
    ],
  },
  {
    id: leagueCredentialEncryptionMigrationId,
    statements: leagueCredentialEncryptionMigrationStatements,
  },
  {
    id: authRateLimitsMigrationId,
    statements: authRateLimitMigrationStatements,
  },
  {
    id: leagueSyncRevisionMigrationId,
    statements: leagueSyncRevisionMigrationStatements,
  },
  {
    id: liveDraftScaleMigrationId,
    statements: liveDraftScaleMigrationStatements,
  },
];

export const requiredPlatformPostgresMigrationIds: readonly string[] =
  platformSchemaMigrations.map(migration => migration.id);
