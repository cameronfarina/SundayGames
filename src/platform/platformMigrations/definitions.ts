import type { PlatformSchemaMigration } from "./contracts.js";
import { corePlatformSchemaMigrations } from "./coreDefinitions.js";
import {
  authRateLimitsMigrationId,
  leagueCredentialEncryptionMigrationId,
  snakeLiveRoomMigrationId,
} from "./ids.js";
import { ownershipPlatformSchemaMigrations } from "./ownershipDefinitions.js";
import {
  authRateLimitMigrationStatements,
  leagueCredentialEncryptionMigrationStatements,
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
];

export const requiredPlatformPostgresMigrationIds: readonly string[] =
  platformSchemaMigrations.map(migration => migration.id);
