import type { PlatformSchemaMigration } from "./contracts.js";
import { corePlatformSchemaMigrations } from "./coreDefinitions.js";
import {
  leagueCredentialEncryptionMigrationId,
  snakeLiveRoomMigrationId,
} from "./ids.js";
import { ownershipPlatformSchemaMigrations } from "./ownershipDefinitions.js";
import { leagueCredentialEncryptionMigrationStatements } from "./schemaStatements.js";

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
];

export const requiredPlatformPostgresMigrationIds: readonly string[] =
  platformSchemaMigrations.map(migration => migration.id);
