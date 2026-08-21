import { platformPostgresMigrationStatements } from "../postgresSchema.js";

export const migrationStatementStartingWith = (prefix: string): string => {
  const statement = platformPostgresMigrationStatements.find(candidate =>
    candidate.startsWith(prefix)
  );
  if (statement === undefined) {
    throw new Error(`Missing platform schema statement for ${prefix}.`);
  }
  return statement;
};

export const liveRoomSetupMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE league_season_draft_setups")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE UNIQUE INDEX draft_rooms_real_season_key")
    .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS"),
];

export const authTokenTableMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE account_auth_tokens")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX account_auth_tokens_account_purpose_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX account_auth_tokens_expires_at_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

export const authRateLimitMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE auth_rate_limit_windows")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX auth_rate_limit_windows_scope_reset_at_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

export const playerNewsMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE player_news_items")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE UNIQUE INDEX player_news_items_provider_item_key")
    .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX player_news_items_published_at_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

export const fantasyProsMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE fantasy_pros_rankings")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX fantasy_pros_rankings_type_ecr_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX fantasy_pros_rankings_player_id_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE TABLE fantasy_pros_projections")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX fantasy_pros_projections_week_position_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE TABLE fantasy_pros_players")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX fantasy_pros_players_position_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE TABLE fantasy_pros_fetch_log")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
];

// FantasyPros ships structured fields RotoWire has no equivalent for, so the
// existing news rows gain columns rather than the feed gaining a second table.
export const playerNewsProviderDataMigrationStatements: readonly string[] = [
  "ALTER TABLE player_news_items ADD COLUMN IF NOT EXISTS categories_json jsonb DEFAULT '[]'::jsonb NOT NULL;",
  "ALTER TABLE player_news_items ADD COLUMN IF NOT EXISTS analyst_impact text;",
  "ALTER TABLE player_news_items ADD COLUMN IF NOT EXISTS provider_player_id text;",
  "ALTER TABLE player_news_items ADD COLUMN IF NOT EXISTS provider_team_id text;",
  migrationStatementStartingWith("CREATE INDEX player_news_items_provider_player_id_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

/**
 * A connection remembers the Sunday Games season it imported. Clearing the link
 * when that season goes away is the whole point of SET NULL: losing the league
 * must not take the connection, and its snapshot, down with it.
 */
export const leagueImportMigrationStatements: readonly string[] = [
  "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS league_season_id text;",
  "ALTER TABLE league_connections DROP CONSTRAINT IF EXISTS league_connections_league_season_id_fkey;",
  "ALTER TABLE league_connections ADD CONSTRAINT league_connections_league_season_id_fkey" +
    " FOREIGN KEY (league_season_id) REFERENCES league_seasons (id) ON DELETE SET NULL;",
];

export const leagueCredentialEncryptionMigrationStatements: readonly string[] = [
  "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS credentials_ciphertext text;",
  "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS credentials_key_id text;",
  "ALTER TABLE league_connections DROP CONSTRAINT IF EXISTS league_connections_encrypted_credentials_pair_check;",
  "ALTER TABLE league_connections ADD CONSTRAINT league_connections_encrypted_credentials_pair_check CHECK ((credentials_ciphertext IS NULL) = (credentials_key_id IS NULL));",
];

export const leagueSyncRevisionMigrationStatements: readonly string[] = [
  "ALTER TABLE league_connections ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 0;",
  "ALTER TABLE league_connection_snapshots ADD COLUMN IF NOT EXISTS sync_revision bigint NOT NULL DEFAULT 0;",
];

export const liveDraftScaleMigrationStatements: readonly string[] = [
  "ALTER TABLE draft_rooms ADD COLUMN IF NOT EXISTS current_projection_json jsonb;",
  migrationStatementStartingWith("CREATE TABLE live_draft_stream_leases")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX live_draft_stream_leases_account_expires_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX live_draft_stream_leases_expires_at_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

export const browserSimulationLifecycleMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE INDEX simulation_runs_cleanup_status_created_at_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
];

export const accountOnboardingMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE account_onboarding_profiles")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  `INSERT INTO account_onboarding_profiles
   (account_id, intent, providers_json, completed_at, created_at, updated_at)
   SELECT id, NULL, NULL, now(), now(), now() FROM accounts
   ON CONFLICT (account_id) DO NOTHING;`,
];

export const accountOnboardingRolloutMigrationStatements: readonly string[] = [
  `DELETE FROM account_onboarding_profiles AS profile
   USING accounts AS account
   WHERE profile.account_id = account.id
     AND profile.intent IS NULL
     AND profile.providers_json IS NULL
     AND profile.completed_at IS NOT NULL
     AND account.created_at >= now() - INTERVAL '5 days'
     AND NOT EXISTS (
       SELECT 1 FROM leagues AS league
       WHERE league.created_by_user_id = account.id
     );`,
];

export const accountOnboardingIntentBothMigrationStatements: readonly string[] = [
  "ALTER TABLE account_onboarding_profiles ADD COLUMN IF NOT EXISTS " +
    "intent_both boolean NOT NULL DEFAULT false;",
];

export const leagueSyncMigrationStatements: readonly string[] = [
  migrationStatementStartingWith("CREATE TABLE league_connections")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE UNIQUE INDEX league_connections_account_league_key")
    .replace("CREATE UNIQUE INDEX", "CREATE UNIQUE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE INDEX league_connections_account_id_idx")
    .replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE TABLE league_connection_snapshots")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
  migrationStatementStartingWith("CREATE TABLE provider_player_directories")
    .replace("CREATE TABLE", "CREATE TABLE IF NOT EXISTS"),
];
