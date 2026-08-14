import { platformInvitationSchemaStatements } from "../postgresPlatformInvitations.js";
import { platformPostgresMigrationStatements } from "../postgresSchema.js";
import type { PlatformSchemaMigration } from "./contracts.js";
import {
  authVersionMigrationId,
  leagueFormatsMigrationId,
  liveRoomPausedMigrationId,
  liveRoomSetupMigrationId,
  platformInvitationsMigrationId,
  platformSchemaMigrationId,
  teamIdentitiesMigrationId,
} from "./ids.js";
import { assertNoDuplicateRealDraftRooms } from "./realRoomPreflight.js";
import { liveRoomSetupMigrationStatements } from "./schemaStatements.js";

export const corePlatformSchemaMigrations: readonly PlatformSchemaMigration[] = [
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
  {
    id: authVersionMigrationId,
    statements: [
      "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
      "ALTER TABLE sessions ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
    ],
  },
  {
    id: teamIdentitiesMigrationId,
    statements: [
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS abbreviation text;",
      "ALTER TABLE fantasy_teams ADD COLUMN IF NOT EXISTS manager_names_json jsonb NOT NULL DEFAULT '[]'::jsonb;",
    ],
  },
  {
    id: leagueFormatsMigrationId,
    statements: [
      "ALTER TABLE roster_rule_sets ADD COLUMN IF NOT EXISTS draft_format text NOT NULL DEFAULT 'auction';",
      "ALTER TABLE roster_rule_sets ADD COLUMN IF NOT EXISTS snake_json jsonb;",
      "ALTER TABLE roster_rule_sets ALTER COLUMN budget DROP NOT NULL;",
      "ALTER TABLE roster_rule_sets ALTER COLUMN minimum_bid DROP NOT NULL;",
      "ALTER TABLE roster_rule_sets DROP CONSTRAINT IF EXISTS roster_rule_sets_budget_check;",
      "ALTER TABLE roster_rule_sets DROP CONSTRAINT IF EXISTS roster_rule_sets_minimum_bid_check;",
      "ALTER TABLE roster_rule_sets DROP CONSTRAINT IF EXISTS roster_rule_sets_draft_format_check;",
      "ALTER TABLE roster_rule_sets DROP CONSTRAINT IF EXISTS roster_rule_sets_format_settings_check;",
      "ALTER TABLE roster_rule_sets ADD CONSTRAINT roster_rule_sets_draft_format_check CHECK (draft_format IN ('auction', 'snake'));",
      "ALTER TABLE roster_rule_sets ADD CONSTRAINT roster_rule_sets_format_settings_check CHECK ((draft_format = 'auction' AND budget IS NOT NULL AND minimum_bid IS NOT NULL AND budget > 0 AND minimum_bid > 0 AND snake_json IS NULL) OR (draft_format = 'snake' AND budget IS NULL AND minimum_bid IS NULL AND snake_json IS NOT NULL));",
    ],
  },
];
