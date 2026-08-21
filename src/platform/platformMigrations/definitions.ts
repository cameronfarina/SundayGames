import type { PlatformSchemaMigration } from "./contracts.js";
import { corePlatformSchemaMigrations } from "./coreDefinitions.js";
import {
  accountOnboardingMigrationId,
  authRateLimitsMigrationId,
  browserSimulationLifecycleMigrationId,
  leagueCredentialEncryptionMigrationId,
  leagueSyncRevisionMigrationId,
  liveDraftScaleMigrationId,
  practicePersistenceMigrationId,
  snakeLiveRoomMigrationId,
} from "./ids.js";
import { ownershipPlatformSchemaMigrations } from "./ownershipDefinitions.js";
import { practicePersistenceMigrationStatements } from "./practicePersistenceStatements.js";
import {
  accountOnboardingMigrationStatements,
  authRateLimitMigrationStatements,
  browserSimulationLifecycleMigrationStatements,
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
  {
    id: practicePersistenceMigrationId,
    statements: practicePersistenceMigrationStatements,
  },
  {
    id: browserSimulationLifecycleMigrationId,
    statements: browserSimulationLifecycleMigrationStatements,
  },
  {
    id: accountOnboardingMigrationId,
    statements: accountOnboardingMigrationStatements,
  },
];

export const requiredPlatformPostgresMigrationIds: readonly string[] =
  platformSchemaMigrations.map(migration => migration.id);
