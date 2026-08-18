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
