import type { PlatformSchemaMigration } from "./contracts.js";
import {
  authOwnershipMigrationId,
  authTokenVersionMigrationId,
  historicalPricingOwnershipMigrationId,
  leagueArchiveMigrationId,
  sharedLeagueInvitationsMigrationId,
} from "./ids.js";
import { authTokenTableMigrationStatements } from "./schemaStatements.js";

export const ownershipPlatformSchemaMigrations: readonly PlatformSchemaMigration[] = [
  {
    id: authOwnershipMigrationId,
    statements: [
      "ALTER TABLE accounts ADD COLUMN IF NOT EXISTS email_verified_at timestamptz;",
      "UPDATE accounts SET email_verified_at = created_at WHERE email_verified_at IS NULL;",
      ...authTokenTableMigrationStatements,
    ],
  },
  {
    id: historicalPricingOwnershipMigrationId,
    statements: [
      "DROP INDEX IF EXISTS leagues_provider_league_id_key;",
      "ALTER TABLE historical_draft_sales ADD COLUMN IF NOT EXISTS public_price_dollars integer;",
      "ALTER TABLE historical_draft_sales DROP CONSTRAINT IF EXISTS historical_draft_sales_public_price_check;",
      "ALTER TABLE historical_draft_sales ADD CONSTRAINT historical_draft_sales_public_price_check CHECK (public_price_dollars IS NULL OR public_price_dollars > 0);",
    ],
  },
  {
    id: sharedLeagueInvitationsMigrationId,
    statements: [
      "ALTER TABLE league_invitations ADD COLUMN IF NOT EXISTS invitation_kind text NOT NULL DEFAULT 'team';",
      "ALTER TABLE league_invitations ALTER COLUMN email_normalized DROP NOT NULL;",
      "ALTER TABLE league_invitations ALTER COLUMN owner_id DROP NOT NULL;",
      "ALTER TABLE league_invitations ALTER COLUMN team_id DROP NOT NULL;",
      "ALTER TABLE league_invitations ALTER COLUMN owner_display_name DROP NOT NULL;",
      "ALTER TABLE league_invitations ALTER COLUMN team_display_name DROP NOT NULL;",
      "ALTER TABLE league_invitations DROP CONSTRAINT IF EXISTS league_invitations_invitation_kind_check;",
      "ALTER TABLE league_invitations ADD CONSTRAINT league_invitations_invitation_kind_check CHECK (invitation_kind IN ('team', 'league'));",
      "ALTER TABLE league_invitations DROP CONSTRAINT IF EXISTS league_invitations_kind_fields_check;",
      "ALTER TABLE league_invitations ADD CONSTRAINT league_invitations_kind_fields_check CHECK ((invitation_kind = 'league' AND email_normalized IS NULL AND owner_id IS NULL AND team_id IS NULL AND owner_display_name IS NULL AND team_display_name IS NULL) OR (invitation_kind = 'team' AND email_normalized IS NOT NULL AND owner_id IS NOT NULL AND team_id IS NOT NULL AND owner_display_name IS NOT NULL AND team_display_name IS NOT NULL));",
      "DROP INDEX IF EXISTS league_invitations_pending_team_key;",
      "CREATE UNIQUE INDEX league_invitations_pending_team_key ON league_invitations (season_id, team_id) WHERE status = 'pending' AND invitation_kind = 'team';",
      "CREATE UNIQUE INDEX IF NOT EXISTS league_invitations_pending_league_key ON league_invitations (season_id) WHERE status = 'pending' AND invitation_kind = 'league';",
    ],
  },
  {
    id: leagueArchiveMigrationId,
    statements: [
      "ALTER TABLE leagues ADD COLUMN IF NOT EXISTS archived_at timestamptz;",
      "ALTER TABLE leagues ADD COLUMN IF NOT EXISTS archived_by_user_id text REFERENCES accounts(id) ON DELETE RESTRICT;",
      "CREATE INDEX IF NOT EXISTS leagues_active_created_by_user_id_idx ON leagues (created_by_user_id) WHERE archived_at IS NULL;",
    ],
  },
  {
    id: authTokenVersionMigrationId,
    statements: [
      "ALTER TABLE account_auth_tokens ADD COLUMN IF NOT EXISTS auth_version bigint NOT NULL DEFAULT 1;",
    ],
  },
];
