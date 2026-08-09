export interface PostgresColumnDefinition {
  name: string;
  type: string;
  nullable?: boolean;
  default?: string;
}

export interface PostgresNamedColumnConstraint {
  name: string;
  columns: readonly string[];
}

export interface PostgresCheckConstraintDefinition {
  name: string;
  expression: string;
}

export type PostgresReferentialAction = "CASCADE" | "RESTRICT" | "SET NULL" | "NO ACTION";

export interface PostgresForeignKeyDefinition extends PostgresNamedColumnConstraint {
  references: {
    table: string;
    columns: readonly string[];
  };
  onDelete?: PostgresReferentialAction;
}

export interface PostgresIndexDefinition extends PostgresNamedColumnConstraint {
  unique?: boolean;
  where?: string;
  using?: string;
}

export interface PostgresTableDefinition {
  name: string;
  columns: readonly PostgresColumnDefinition[];
  primaryKey: readonly string[];
  uniqueConstraints?: readonly PostgresNamedColumnConstraint[];
  checkConstraints?: readonly PostgresCheckConstraintDefinition[];
  foreignKeys?: readonly PostgresForeignKeyDefinition[];
  indexes?: readonly PostgresIndexDefinition[];
}

export interface PostgresDeferredForeignKeyDefinition extends PostgresForeignKeyDefinition {
  table: string;
}

export interface PostgresSchemaContract {
  tables: readonly PostgresTableDefinition[];
  deferredForeignKeys: readonly PostgresDeferredForeignKeyDefinition[];
  statements: readonly string[];
}

const createdAtColumn: PostgresColumnDefinition = {
  name: "created_at",
  type: "timestamptz",
  default: "now()",
};

const updatedAtColumn: PostgresColumnDefinition = {
  name: "updated_at",
  type: "timestamptz",
  default: "now()",
};

const timestamps = [createdAtColumn, updatedAtColumn] as const;

const jsonbDefault = "'{}'::jsonb";
const jsonbArrayDefault = "'[]'::jsonb";

const platformPostgresTables = [
  {
    name: "accounts",
    columns: [
      { name: "id", type: "text" },
      { name: "email", type: "text" },
      { name: "email_normalized", type: "text" },
      { name: "password_hash", type: "text" },
      { name: "display_name", type: "text", nullable: true },
      { name: "status", type: "text", default: "'active'" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "accounts_email_normalized_key", columns: ["email_normalized"] },
    ],
    checkConstraints: [
      { name: "accounts_email_normalized_not_blank", expression: "length(trim(email_normalized)) > 0" },
      { name: "accounts_status_check", expression: "status IN ('active', 'disabled', 'deleted')" },
    ],
  },
  {
    name: "sessions",
    columns: [
      { name: "id", type: "text" },
      { name: "account_id", type: "text" },
      { name: "token_hash", type: "text" },
      { name: "expires_at", type: "timestamptz" },
      { name: "revoked_at", type: "timestamptz", nullable: true },
      { name: "last_used_at", type: "timestamptz", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "sessions_token_hash_key", columns: ["token_hash"] },
    ],
    foreignKeys: [
      {
        name: "sessions_account_id_fkey",
        columns: ["account_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "sessions_account_id_idx", columns: ["account_id"] },
      { name: "sessions_expires_at_idx", columns: ["expires_at"] },
    ],
  },
  {
    name: "leagues",
    columns: [
      { name: "id", type: "text" },
      { name: "name", type: "text" },
      { name: "sport", type: "text", default: "'football'" },
      { name: "provider", type: "text", nullable: true },
      { name: "provider_league_id", type: "text", nullable: true },
      { name: "created_by_user_id", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "leagues_name_not_blank", expression: "length(trim(name)) > 0" },
      { name: "leagues_sport_check", expression: "sport IN ('football')" },
    ],
    foreignKeys: [
      {
        name: "leagues_created_by_user_id_fkey",
        columns: ["created_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      {
        name: "leagues_provider_league_id_key",
        columns: ["provider", "provider_league_id"],
        unique: true,
        where: "provider IS NOT NULL AND provider_league_id IS NOT NULL",
      },
      { name: "leagues_created_by_user_id_idx", columns: ["created_by_user_id"] },
    ],
  },
  {
    name: "league_memberships",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "role", type: "text" },
      { name: "status", type: "text", default: "'active'" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "league_memberships_league_user_key", columns: ["league_id", "user_id"] },
    ],
    checkConstraints: [
      { name: "league_memberships_role_check", expression: "role IN ('owner', 'admin', 'member', 'observer')" },
      { name: "league_memberships_status_check", expression: "status IN ('invited', 'active', 'disabled')" },
    ],
    foreignKeys: [
      {
        name: "league_memberships_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "league_memberships_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "league_memberships_user_status_idx", columns: ["user_id", "status"] },
    ],
  },
  {
    name: "league_seasons",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "season_year", type: "integer" },
      { name: "name", type: "text" },
      { name: "status", type: "text", default: "'draft'" },
      { name: "published_at", type: "timestamptz", nullable: true },
      { name: "locked_at", type: "timestamptz", nullable: true },
      { name: "active_model_run_id", type: "text", nullable: true },
      { name: "active_pricing_snapshot_id", type: "text", nullable: true },
      { name: "settings_json", type: "jsonb", default: jsonbDefault },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "league_seasons_league_year_key", columns: ["league_id", "season_year"] },
    ],
    checkConstraints: [
      { name: "league_seasons_status_check", expression: "status IN ('draft', 'published', 'locked')" },
      { name: "league_seasons_year_check", expression: "season_year >= 2000" },
    ],
    foreignKeys: [
      {
        name: "league_seasons_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "league_seasons_league_status_idx", columns: ["league_id", "status"] },
    ],
  },
  {
    name: "fantasy_teams",
    columns: [
      { name: "id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "team_key", type: "text" },
      { name: "team_name", type: "text" },
      { name: "owner_name", type: "text" },
      { name: "owner_user_id", type: "text", nullable: true },
      { name: "display_order", type: "integer" },
      { name: "aliases_json", type: "jsonb", default: jsonbArrayDefault },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "fantasy_teams_season_team_key", columns: ["league_season_id", "team_key"] },
      { name: "fantasy_teams_season_display_order_key", columns: ["league_season_id", "display_order"] },
    ],
    checkConstraints: [
      { name: "fantasy_teams_display_order_check", expression: "display_order > 0" },
    ],
    foreignKeys: [
      {
        name: "fantasy_teams_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "fantasy_teams_owner_user_id_fkey",
        columns: ["owner_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "fantasy_teams_owner_user_id_idx", columns: ["owner_user_id"] },
    ],
  },
  {
    name: "roster_rule_sets",
    columns: [
      { name: "id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "budget", type: "integer" },
      { name: "minimum_bid", type: "integer" },
      { name: "slots_json", type: "jsonb", default: jsonbDefault },
      { name: "position_maximums_json", type: "jsonb", default: jsonbDefault },
      { name: "scoring_json", type: "jsonb", default: jsonbDefault },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "roster_rule_sets_league_season_key", columns: ["league_season_id"] },
    ],
    checkConstraints: [
      { name: "roster_rule_sets_budget_check", expression: "budget > 0" },
      { name: "roster_rule_sets_minimum_bid_check", expression: "minimum_bid > 0" },
    ],
    foreignKeys: [
      {
        name: "roster_rule_sets_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
  {
    name: "players",
    columns: [
      { name: "id", type: "text" },
      { name: "provider", type: "text", nullable: true },
      { name: "provider_player_id", type: "text", nullable: true },
      { name: "canonical_name", type: "text" },
      { name: "position", type: "text" },
      { name: "nfl_team", type: "text", nullable: true },
      { name: "bye_week", type: "integer", nullable: true },
      { name: "active", type: "boolean", default: "true" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "players_position_check", expression: "position IN ('QB', 'RB', 'WR', 'TE', 'K', 'DST')" },
      { name: "players_bye_week_check", expression: "bye_week IS NULL OR bye_week BETWEEN 1 AND 18" },
    ],
    indexes: [
      {
        name: "players_provider_player_id_key",
        columns: ["provider", "provider_player_id"],
        unique: true,
        where: "provider IS NOT NULL AND provider_player_id IS NOT NULL",
      },
      { name: "players_canonical_name_position_idx", columns: ["canonical_name", "position"] },
    ],
  },
  {
    name: "player_aliases",
    columns: [
      { name: "id", type: "text" },
      { name: "player_id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "alias_normalized", type: "text" },
      { name: "source", type: "text" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "player_aliases_league_alias_player_key", columns: ["league_id", "alias_normalized", "player_id"] },
    ],
    foreignKeys: [
      {
        name: "player_aliases_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "player_aliases_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "player_aliases_alias_normalized_idx", columns: ["alias_normalized"] },
    ],
  },
  {
    name: "keeper_declarations",
    columns: [
      { name: "id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "fantasy_team_id", type: "text" },
      { name: "player_id", type: "text" },
      { name: "player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "keeper_cost", type: "integer" },
      { name: "previous_cost", type: "integer", nullable: true },
      { name: "status", type: "text" },
      { name: "source", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "keeper_declarations_cost_check", expression: "keeper_cost >= 0" },
      { name: "keeper_declarations_previous_cost_check", expression: "previous_cost IS NULL OR previous_cost >= 0" },
      { name: "keeper_declarations_status_check", expression: "status IN ('draft', 'active', 'published', 'removed')" },
    ],
    foreignKeys: [
      {
        name: "keeper_declarations_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "keeper_declarations_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "keeper_declarations_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      {
        name: "keeper_declarations_active_player_key",
        columns: ["league_season_id", "player_id"],
        unique: true,
        where: "status IN ('active', 'published')",
      },
      { name: "keeper_declarations_season_team_idx", columns: ["league_season_id", "fantasy_team_id"] },
    ],
  },
  {
    name: "historical_import_batches",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text", nullable: true },
      { name: "season_year", type: "integer" },
      { name: "uploaded_by_user_id", type: "text" },
      { name: "file_name", type: "text" },
      { name: "file_hash", type: "text" },
      { name: "status", type: "text" },
      { name: "replacement_requested", type: "boolean", default: "false" },
      { name: "mapping_json", type: "jsonb", default: jsonbDefault },
      { name: "warnings_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "blockers_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "committed_at", type: "timestamptz", nullable: true },
      { name: "superseded_at", type: "timestamptz", nullable: true },
      { name: "superseded_by_batch_id", type: "text", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "historical_import_batches_status_check", expression: "status IN ('previewed', 'blocked', 'committed', 'superseded')" },
      { name: "historical_import_batches_year_check", expression: "season_year >= 2000" },
    ],
    foreignKeys: [
      {
        name: "historical_import_batches_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_import_batches_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_import_batches_uploaded_by_user_id_fkey",
        columns: ["uploaded_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "historical_import_batches_superseded_by_batch_id_fkey",
        columns: ["superseded_by_batch_id"],
        references: { table: "historical_import_batches", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "historical_import_batches_file_identity_key",
        columns: ["league_id", "season_year", "file_hash"],
        unique: true,
        where: "superseded_by_batch_id IS NULL",
      },
      {
        name: "historical_import_batches_current_committed_season_key",
        columns: ["league_id", "season_year"],
        unique: true,
        where: "status = 'committed'",
      },
      { name: "historical_import_batches_league_year_status_idx", columns: ["league_id", "season_year", "status"] },
    ],
  },
  {
    name: "historical_draft_sales",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text", nullable: true },
      { name: "season_year", type: "integer" },
      { name: "import_batch_id", type: "text" },
      { name: "fantasy_team_id", type: "text", nullable: true },
      { name: "owner_id", type: "text" },
      { name: "owner_display_name", type: "text" },
      { name: "player_id", type: "text" },
      { name: "player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "price_dollars", type: "integer" },
      { name: "keeper", type: "boolean", default: "false" },
      { name: "acquisition_type", type: "text" },
      { name: "row_number", type: "integer" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "historical_draft_sales_batch_row_key", columns: ["import_batch_id", "row_number"] },
    ],
    checkConstraints: [
      { name: "historical_draft_sales_price_check", expression: "price_dollars >= 0" },
      { name: "historical_draft_sales_row_number_check", expression: "row_number > 0" },
      { name: "historical_draft_sales_acquisition_type_check", expression: "acquisition_type IN ('auction', 'keeper')" },
    ],
    foreignKeys: [
      {
        name: "historical_draft_sales_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_draft_sales_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_draft_sales_import_batch_id_fkey",
        columns: ["import_batch_id"],
        references: { table: "historical_import_batches", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_draft_sales_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_draft_sales_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "historical_draft_sales_league_year_idx", columns: ["league_id", "season_year"] },
      { name: "historical_draft_sales_import_batch_idx", columns: ["import_batch_id"] },
      { name: "historical_draft_sales_player_id_idx", columns: ["player_id"] },
    ],
  },
  {
    name: "model_runs",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "model_version", type: "text" },
      { name: "input_snapshot_id", type: "text" },
      { name: "input_hash", type: "text" },
      { name: "status", type: "text" },
      { name: "created_by_user_id", type: "text" },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "error_summary", type: "text", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "model_runs_input_identity_key", columns: ["league_season_id", "model_version", "input_hash"] },
    ],
    checkConstraints: [
      { name: "model_runs_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed', 'canceled')" },
    ],
    foreignKeys: [
      {
        name: "model_runs_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "model_runs_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "model_runs_created_by_user_id_fkey",
        columns: ["created_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "model_runs_league_season_status_idx", columns: ["league_season_id", "status"] },
    ],
  },
  {
    name: "pricing_snapshots",
    columns: [
      { name: "id", type: "text" },
      { name: "model_run_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "scenario_id", type: "text" },
      { name: "snapshot_hash", type: "text" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "pricing_snapshots_model_run_scenario_key", columns: ["model_run_id", "scenario_id"] },
      { name: "pricing_snapshots_snapshot_hash_key", columns: ["snapshot_hash"] },
    ],
    foreignKeys: [
      {
        name: "pricing_snapshots_model_run_id_fkey",
        columns: ["model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "pricing_snapshots_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "pricing_snapshots_league_season_idx", columns: ["league_season_id"] },
    ],
  },
  {
    name: "player_prices",
    columns: [
      { name: "id", type: "text" },
      { name: "pricing_snapshot_id", type: "text" },
      { name: "player_id", type: "text", nullable: true },
      { name: "player_key", type: "text" },
      { name: "player_name", type: "text" },
      { name: "normalized_name", type: "text" },
      { name: "position", type: "text" },
      { name: "market_price", type: "integer" },
      { name: "scenario_price", type: "integer" },
      { name: "live_price", type: "integer" },
      { name: "personal_value", type: "integer" },
      { name: "recommended_max_bid", type: "integer" },
      { name: "warnings_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "confidence", type: "numeric", nullable: true },
      { name: "tier", type: "text", nullable: true },
      { name: "strategy_overlay_id", type: "text", nullable: true },
      { name: "explanation_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "player_prices_snapshot_player_key", columns: ["pricing_snapshot_id", "player_key"] },
    ],
    checkConstraints: [
      { name: "player_prices_non_negative_check", expression: "market_price >= 0 AND scenario_price >= 0 AND live_price >= 0 AND personal_value >= 0 AND recommended_max_bid >= 0" },
      { name: "player_prices_position_check", expression: "position IN ('QB', 'RB', 'WR', 'TE', 'K', 'DST')" },
      { name: "player_prices_confidence_check", expression: "confidence IS NULL OR confidence BETWEEN 0 AND 1" },
    ],
    foreignKeys: [
      {
        name: "player_prices_pricing_snapshot_id_fkey",
        columns: ["pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "player_prices_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "player_prices_player_id_idx", columns: ["player_id"] },
    ],
  },
  {
    name: "jobs",
    columns: [
      { name: "id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "kind", type: "text" },
      { name: "status", type: "text" },
      { name: "idempotency_key", type: "text" },
      { name: "input_hash", type: "text" },
      { name: "input_json", type: "jsonb", default: jsonbDefault },
      { name: "progress_json", type: "jsonb", default: jsonbDefault },
      { name: "result_summary_json", type: "jsonb", nullable: true },
      { name: "attempt_count", type: "integer", default: "0" },
      { name: "max_attempts", type: "integer", default: "3" },
      { name: "locked_by", type: "text", nullable: true },
      { name: "locked_at", type: "timestamptz", nullable: true },
      { name: "heartbeat_at", type: "timestamptz", nullable: true },
      { name: "lock_expires_at", type: "timestamptz", nullable: true },
      { name: "available_at", type: "timestamptz", default: "now()" },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "finished_at", type: "timestamptz", nullable: true },
      { name: "cancellation_requested_at", type: "timestamptz", nullable: true },
      { name: "sanitized_error_json", type: "jsonb", nullable: true },
      { name: "error_summary", type: "text", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "jobs_user_league_season_idempotency_key", columns: ["user_id", "league_id", "league_season_id", "idempotency_key"] },
    ],
    checkConstraints: [
      { name: "jobs_kind_check", expression: "kind IN ('import', 'model_run', 'simulation', 'export', 'maintenance')" },
      { name: "jobs_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed', 'canceled')" },
      { name: "jobs_attempts_check", expression: "attempt_count >= 0 AND max_attempts > 0" },
    ],
    foreignKeys: [
      {
        name: "jobs_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "jobs_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "jobs_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "jobs_claimable_idx", columns: ["status", "available_at", "created_at"] },
      { name: "jobs_expired_lease_idx", columns: ["status", "lock_expires_at"] },
      { name: "jobs_locked_by_locked_at_idx", columns: ["locked_by", "locked_at"] },
      { name: "jobs_user_status_idx", columns: ["user_id", "status"] },
    ],
  },
  {
    name: "strategy_plans",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "title", type: "text" },
      { name: "status", type: "text" },
      { name: "selected_owner_id", type: "text", nullable: true },
      { name: "selected_team_id", type: "text", nullable: true },
      { name: "strategy_key", type: "text", nullable: true },
      { name: "current_version_id", type: "text", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "strategy_plans_status_check", expression: "status IN ('draft', 'active', 'archived')" },
    ],
    foreignKeys: [
      {
        name: "strategy_plans_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "strategy_plans_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "strategy_plans_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "strategy_plans_selected_team_id_fkey",
        columns: ["selected_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "strategy_plans_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      { name: "strategy_plans_league_user_idx", columns: ["league_id", "user_id"] },
    ],
  },
  {
    name: "strategy_plan_versions",
    columns: [
      { name: "id", type: "text" },
      { name: "strategy_plan_id", type: "text" },
      { name: "version_number", type: "integer" },
      { name: "prompt", type: "text" },
      { name: "summary", type: "text" },
      { name: "commands_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "locks_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "targets_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "guardrails_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "context_manifest_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "strategy_plan_versions_plan_version_key", columns: ["strategy_plan_id", "version_number"] },
    ],
    checkConstraints: [
      { name: "strategy_plan_versions_version_number_check", expression: "version_number > 0" },
    ],
    foreignKeys: [
      {
        name: "strategy_plan_versions_strategy_plan_id_fkey",
        columns: ["strategy_plan_id"],
        references: { table: "strategy_plans", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
  {
    name: "target_lists",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "strategy_plan_id", type: "text", nullable: true },
      { name: "strategy_plan_version_id", type: "text", nullable: true },
      { name: "name", type: "text" },
      { name: "status", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "target_lists_status_check", expression: "status IN ('active', 'archived')" },
    ],
    foreignKeys: [
      {
        name: "target_lists_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "target_lists_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "target_lists_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "target_lists_strategy_plan_id_fkey",
        columns: ["strategy_plan_id"],
        references: { table: "strategy_plans", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "target_lists_strategy_plan_version_id_fkey",
        columns: ["strategy_plan_version_id"],
        references: { table: "strategy_plan_versions", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "target_lists_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      { name: "target_lists_league_user_idx", columns: ["league_id", "user_id"] },
    ],
  },
  {
    name: "target_list_items",
    columns: [
      { name: "id", type: "text" },
      { name: "target_list_id", type: "text" },
      { name: "player_id", type: "text", nullable: true },
      { name: "player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "max_bid", type: "integer", nullable: true },
      { name: "priority", type: "integer" },
      { name: "tags_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "rationale", type: "text", nullable: true },
      { name: "source_ref_json", type: "jsonb", default: jsonbDefault },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "target_list_items_max_bid_check", expression: "max_bid IS NULL OR max_bid >= 0" },
      { name: "target_list_items_priority_check", expression: "priority > 0" },
    ],
    foreignKeys: [
      {
        name: "target_list_items_target_list_id_fkey",
        columns: ["target_list_id"],
        references: { table: "target_lists", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "target_list_items_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "target_list_items_list_player_key",
        columns: ["target_list_id", "player_id"],
        unique: true,
        where: "player_id IS NOT NULL",
      },
      { name: "target_list_items_list_priority_idx", columns: ["target_list_id", "priority"] },
    ],
  },
  {
    name: "private_notes",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "player_id", type: "text", nullable: true },
      { name: "strategy_plan_id", type: "text", nullable: true },
      { name: "target_list_id", type: "text", nullable: true },
      { name: "body", type: "text" },
      { name: "tags_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "source_ref_json", type: "jsonb", default: jsonbDefault },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "private_notes_body_not_blank", expression: "length(trim(body)) > 0" },
    ],
    foreignKeys: [
      {
        name: "private_notes_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "private_notes_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "private_notes_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "private_notes_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "private_notes_strategy_plan_id_fkey",
        columns: ["strategy_plan_id"],
        references: { table: "strategy_plans", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "private_notes_target_list_id_fkey",
        columns: ["target_list_id"],
        references: { table: "target_lists", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "private_notes_private_owner_idx", columns: ["user_id", "league_season_id", "updated_at"] },
      { name: "private_notes_player_idx", columns: ["player_id"] },
    ],
  },
  {
    name: "coach_conversations",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "title", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["id"],
    foreignKeys: [
      {
        name: "coach_conversations_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "coach_conversations_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "coach_conversations_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "coach_conversations_private_owner_idx", columns: ["user_id", "league_season_id", "updated_at"] },
      { name: "coach_conversations_league_user_idx", columns: ["league_id", "user_id"] },
    ],
  },
  {
    name: "coach_messages",
    columns: [
      { name: "id", type: "text" },
      { name: "conversation_id", type: "text" },
      { name: "role", type: "text" },
      { name: "content", type: "text" },
      { name: "context_refs_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "tool_calls_json", type: "jsonb", default: jsonbArrayDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "coach_messages_role_check", expression: "role IN ('user', 'assistant', 'system', 'tool')" },
    ],
    foreignKeys: [
      {
        name: "coach_messages_conversation_id_fkey",
        columns: ["conversation_id"],
        references: { table: "coach_conversations", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "coach_messages_conversation_created_at_idx", columns: ["conversation_id", "created_at"] },
    ],
  },
  {
    name: "mock_sessions",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "owner_id", type: "text" },
      { name: "team_id", type: "text" },
      { name: "model_run_id", type: "text", nullable: true },
      { name: "pricing_snapshot_id", type: "text", nullable: true },
      { name: "status", type: "text" },
      { name: "revision", type: "integer", default: "1" },
      { name: "command_count", type: "integer", default: "0" },
      { name: "seed", type: "text", nullable: true },
      { name: "draft_mode_json", type: "jsonb", default: jsonbDefault },
      { name: "latest_result_ref_json", type: "jsonb", nullable: true },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "abandoned_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "mock_sessions_status_check", expression: "status IN ('setup', 'active', 'completed', 'abandoned')" },
      { name: "mock_sessions_revision_check", expression: "revision > 0" },
      { name: "mock_sessions_command_count_check", expression: "command_count >= 0" },
    ],
    foreignKeys: [
      {
        name: "mock_sessions_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_team_id_fkey",
        columns: ["team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "mock_sessions_model_run_id_fkey",
        columns: ["model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "mock_sessions_pricing_snapshot_id_fkey",
        columns: ["pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "mock_sessions_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      { name: "mock_sessions_owner_team_idx", columns: ["league_season_id", "owner_id", "team_id"] },
    ],
  },
  {
    name: "mock_session_events",
    columns: [
      { name: "id", type: "text" },
      { name: "mock_session_id", type: "text" },
      { name: "revision", type: "integer" },
      { name: "sequence", type: "integer" },
      { name: "event_type", type: "text" },
      { name: "command_id", type: "text", nullable: true },
      { name: "command", type: "text", nullable: true },
      { name: "payload_json", type: "jsonb", default: jsonbDefault },
      { name: "idempotency_key", type: "text", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "mock_session_events_sequence_key", columns: ["mock_session_id", "sequence"] },
    ],
    checkConstraints: [
      { name: "mock_session_events_revision_check", expression: "revision > 0" },
      { name: "mock_session_events_sequence_check", expression: "sequence > 0" },
    ],
    foreignKeys: [
      {
        name: "mock_session_events_mock_session_id_fkey",
        columns: ["mock_session_id"],
        references: { table: "mock_sessions", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      {
        name: "mock_session_events_revision_idempotency_key",
        columns: ["mock_session_id", "revision", "idempotency_key"],
        unique: true,
        where: "idempotency_key IS NOT NULL",
      },
      { name: "mock_session_events_session_created_at_idx", columns: ["mock_session_id", "created_at"] },
    ],
  },
  {
    name: "simulation_runs",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "job_id", type: "text", nullable: true },
      { name: "model_run_id", type: "text", nullable: true },
      { name: "pricing_snapshot_id", type: "text", nullable: true },
      { name: "strategy_plan_version_id", type: "text", nullable: true },
      { name: "owner_id", type: "text" },
      { name: "team_id", type: "text" },
      { name: "idempotency_key", type: "text" },
      { name: "input_hash", type: "text" },
      { name: "request_json", type: "jsonb", default: jsonbDefault },
      { name: "status", type: "text" },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "simulation_runs_user_league_season_idempotency_key", columns: ["user_id", "league_id", "league_season_id", "idempotency_key"] },
    ],
    checkConstraints: [
      { name: "simulation_runs_status_check", expression: "status IN ('requested', 'queued', 'running', 'completed', 'failed', 'canceled')" },
    ],
    foreignKeys: [
      {
        name: "simulation_runs_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_job_id_fkey",
        columns: ["job_id"],
        references: { table: "jobs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_model_run_id_fkey",
        columns: ["model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_pricing_snapshot_id_fkey",
        columns: ["pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_strategy_plan_version_id_fkey",
        columns: ["strategy_plan_version_id"],
        references: { table: "strategy_plan_versions", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_team_id_fkey",
        columns: ["team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "simulation_runs_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      {
        name: "simulation_runs_job_id_key",
        columns: ["job_id"],
        unique: true,
        where: "job_id IS NOT NULL",
      },
    ],
  },
  {
    name: "simulation_results",
    columns: [
      { name: "id", type: "text" },
      { name: "simulation_run_id", type: "text" },
      { name: "summary_json", type: "jsonb", default: jsonbDefault },
      { name: "result_set_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "simulation_results_run_key", columns: ["simulation_run_id"] },
    ],
    foreignKeys: [
      {
        name: "simulation_results_simulation_run_id_fkey",
        columns: ["simulation_run_id"],
        references: { table: "simulation_runs", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
  {
    name: "draft_rooms",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "room_type", type: "text" },
      { name: "status", type: "text" },
      { name: "created_by_user_id", type: "text" },
      { name: "active_model_run_id", type: "text", nullable: true },
      { name: "active_pricing_snapshot_id", type: "text", nullable: true },
      { name: "current_revision", type: "integer", default: "1" },
      { name: "starts_at", type: "timestamptz", nullable: true },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "ended_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "draft_rooms_room_type_check", expression: "room_type IN ('real', 'practice')" },
      { name: "draft_rooms_status_check", expression: "status IN ('setup', 'countdown', 'live', 'ended')" },
      { name: "draft_rooms_current_revision_check", expression: "current_revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_rooms_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_rooms_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_rooms_created_by_user_id_fkey",
        columns: ["created_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_rooms_active_model_run_id_fkey",
        columns: ["active_model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "draft_rooms_active_pricing_snapshot_id_fkey",
        columns: ["active_pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "draft_rooms_league_season_status_idx", columns: ["league_season_id", "status"] },
    ],
  },
  {
    name: "draft_room_participants",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "selected_team_id", type: "text", nullable: true },
      { name: "role", type: "text" },
      { name: "last_seen_revision", type: "integer", default: "0" },
      { name: "connected_at", type: "timestamptz", nullable: true },
      { name: "disconnected_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_participants_room_user_key", columns: ["draft_room_id", "user_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_participants_role_check", expression: "role IN ('commissioner', 'admin', 'member', 'observer')" },
      { name: "draft_room_participants_last_seen_revision_check", expression: "last_seen_revision >= 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_participants_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_participants_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_participants_selected_team_id_fkey",
        columns: ["selected_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "draft_room_participants_room_team_idx", columns: ["draft_room_id", "selected_team_id"] },
    ],
  },
  {
    name: "draft_room_events",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "revision", type: "integer" },
      { name: "sequence", type: "integer" },
      { name: "event_type", type: "text" },
      { name: "actor_user_id", type: "text" },
      { name: "idempotency_key", type: "text", nullable: true },
      { name: "mutation_hash", type: "text", nullable: true },
      { name: "expected_revision", type: "integer", nullable: true },
      { name: "raw_command", type: "text", nullable: true },
      { name: "payload_json", type: "jsonb", default: jsonbDefault },
      { name: "validation_json", type: "jsonb", default: jsonbDefault },
      { name: "occurred_at", type: "timestamptz" },
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_events_room_revision_key", columns: ["draft_room_id", "revision"] },
      { name: "draft_room_events_room_sequence_key", columns: ["draft_room_id", "sequence"] },
    ],
    checkConstraints: [
      { name: "draft_room_events_revision_check", expression: "revision > 0" },
      { name: "draft_room_events_sequence_check", expression: "sequence > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_events_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_events_actor_user_id_fkey",
        columns: ["actor_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      {
        name: "draft_room_events_mutation_idempotency_key",
        columns: ["draft_room_id", "idempotency_key"],
        unique: true,
        where: "idempotency_key IS NOT NULL",
      },
      { name: "draft_room_events_room_occurred_at_idx", columns: ["draft_room_id", "occurred_at"] },
    ],
  },
  {
    name: "draft_room_sales",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "source_event_id", type: "text" },
      { name: "fantasy_team_id", type: "text" },
      { name: "player_id", type: "text", nullable: true },
      { name: "player_name", type: "text" },
      { name: "normalized_player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "price", type: "integer" },
      { name: "expected_price", type: "integer", nullable: true },
      { name: "live_price", type: "integer", nullable: true },
      { name: "status", type: "text" },
      { name: "voided_by_event_id", type: "text", nullable: true },
      { name: "corrected_by_event_id", type: "text", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_sales_source_event_key", columns: ["source_event_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_sales_price_check", expression: "price > 0" },
      { name: "draft_room_sales_status_check", expression: "status IN ('active', 'voided', 'corrected')" },
    ],
    foreignKeys: [
      {
        name: "draft_room_sales_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_sales_source_event_id_fkey",
        columns: ["source_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_sales_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_sales_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "draft_room_sales_voided_by_event_id_fkey",
        columns: ["voided_by_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "draft_room_sales_corrected_by_event_id_fkey",
        columns: ["corrected_by_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "draft_room_sales_active_player_key",
        columns: ["draft_room_id", "player_id"],
        unique: true,
        where: "status = 'active' AND player_id IS NOT NULL",
      },
      {
        name: "draft_room_sales_active_normalized_player_key",
        columns: ["draft_room_id", "normalized_player_name"],
        unique: true,
        where: "status = 'active'",
      },
      { name: "draft_room_sales_room_team_idx", columns: ["draft_room_id", "fantasy_team_id"] },
    ],
  },
  {
    name: "draft_room_team_states",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "fantasy_team_id", type: "text" },
      { name: "spent", type: "integer" },
      { name: "remaining_budget", type: "integer" },
      { name: "max_bid", type: "integer" },
      { name: "roster_slots_remaining", type: "integer" },
      { name: "position_counts_json", type: "jsonb", default: jsonbDefault },
      { name: "roster_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "validity_json", type: "jsonb", default: jsonbDefault },
      { name: "revision", type: "integer" },
      updatedAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_team_states_room_team_key", columns: ["draft_room_id", "fantasy_team_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_team_states_non_negative_check", expression: "spent >= 0 AND remaining_budget >= 0 AND max_bid >= 0 AND roster_slots_remaining >= 0" },
      { name: "draft_room_team_states_revision_check", expression: "revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_team_states_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_team_states_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "draft_room_team_states_room_revision_idx", columns: ["draft_room_id", "revision"] },
    ],
  },
  {
    name: "draft_room_player_states",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "player_id", type: "text" },
      { name: "state", type: "text" },
      { name: "fantasy_team_id", type: "text", nullable: true },
      { name: "price", type: "integer", nullable: true },
      { name: "revision", type: "integer" },
      updatedAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_player_states_room_player_key", columns: ["draft_room_id", "player_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_player_states_state_check", expression: "state IN ('available', 'sold', 'keeper', 'unavailable')" },
      { name: "draft_room_player_states_price_check", expression: "price IS NULL OR price >= 0" },
      { name: "draft_room_player_states_revision_check", expression: "revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_player_states_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_player_states_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_player_states_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "draft_room_player_states_room_state_idx", columns: ["draft_room_id", "state"] },
    ],
  },
  {
    name: "draft_room_snapshots",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "revision", type: "integer" },
      { name: "snapshot_json", type: "jsonb", default: jsonbDefault },
      { name: "snapshot_hash", type: "text" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_snapshots_room_revision_key", columns: ["draft_room_id", "revision"] },
    ],
    checkConstraints: [
      { name: "draft_room_snapshots_revision_check", expression: "revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_snapshots_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "draft_room_snapshots_room_hash_idx", columns: ["draft_room_id", "snapshot_hash"] },
    ],
  },
  {
    name: "draft_room_exports",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "created_by_user_id", type: "text" },
      { name: "job_id", type: "text", nullable: true },
      { name: "artifact_type", type: "text" },
      { name: "status", type: "text" },
      { name: "storage_key", type: "text", nullable: true },
      { name: "payload_hash", type: "text" },
      { name: "content_type", type: "text" },
      { name: "byte_length", type: "integer" },
      { name: "source_revision", type: "integer" },
      { name: "metadata_json", type: "jsonb", default: jsonbDefault },
      { name: "created_at", type: "timestamptz", default: "now()" },
      { name: "completed_at", type: "timestamptz", nullable: true },
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "draft_room_exports_artifact_type_check", expression: "artifact_type IN ('xlsx', 'csv')" },
      { name: "draft_room_exports_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed')" },
      { name: "draft_room_exports_byte_length_check", expression: "byte_length >= 0" },
      { name: "draft_room_exports_source_revision_check", expression: "source_revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_exports_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_created_by_user_id_fkey",
        columns: ["created_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_exports_job_id_fkey",
        columns: ["job_id"],
        references: { table: "jobs", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "draft_room_exports_completed_revision_artifact_key",
        columns: ["draft_room_id", "source_revision", "artifact_type"],
        unique: true,
        where: "status = 'completed'",
      },
      { name: "draft_room_exports_league_season_status_idx", columns: ["league_season_id", "status"] },
    ],
  },
  {
    name: "draft_room_export_contents",
    columns: [
      { name: "id", type: "text" },
      { name: "artifact_id", type: "text" },
      { name: "content_base64", type: "text" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_export_contents_artifact_key", columns: ["artifact_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_export_contents_content_not_blank", expression: "length(trim(content_base64)) > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_export_contents_artifact_id_fkey",
        columns: ["artifact_id"],
        references: { table: "draft_room_exports", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
  {
    name: "audit_events",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text", nullable: true },
      { name: "user_id", type: "text", nullable: true },
      { name: "event_type", type: "text" },
      { name: "resource_type", type: "text" },
      { name: "resource_id", type: "text" },
      { name: "metadata_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    foreignKeys: [
      {
        name: "audit_events_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "audit_events_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "audit_events_league_created_at_idx", columns: ["league_id", "created_at"] },
      { name: "audit_events_user_created_at_idx", columns: ["user_id", "created_at"] },
    ],
  },
] satisfies readonly PostgresTableDefinition[];

const platformPostgresDeferredForeignKeys = [
  {
    table: "league_seasons",
    name: "league_seasons_active_model_run_id_fkey",
    columns: ["active_model_run_id"],
    references: { table: "model_runs", columns: ["id"] },
    onDelete: "SET NULL",
  },
  {
    table: "league_seasons",
    name: "league_seasons_active_pricing_snapshot_id_fkey",
    columns: ["active_pricing_snapshot_id"],
    references: { table: "pricing_snapshots", columns: ["id"] },
    onDelete: "SET NULL",
  },
  {
    table: "strategy_plans",
    name: "strategy_plans_current_version_id_fkey",
    columns: ["current_version_id"],
    references: { table: "strategy_plan_versions", columns: ["id"] },
    onDelete: "SET NULL",
  },
] satisfies readonly PostgresDeferredForeignKeyDefinition[];

const renderColumns = (columns: readonly string[]): string => columns.join(", ");

const renderColumnDefinition = (column: PostgresColumnDefinition): string => [
  column.name,
  column.type,
  column.default === undefined ? undefined : `DEFAULT ${column.default}`,
  column.nullable === true ? undefined : "NOT NULL",
].filter((part): part is string => part !== undefined).join(" ");

const renderForeignKeyConstraint = (foreignKey: PostgresForeignKeyDefinition): string => [
  `CONSTRAINT ${foreignKey.name}`,
  `FOREIGN KEY (${renderColumns(foreignKey.columns)})`,
  `REFERENCES ${foreignKey.references.table} (${renderColumns(foreignKey.references.columns)})`,
  foreignKey.onDelete === undefined ? undefined : `ON DELETE ${foreignKey.onDelete}`,
].filter((part): part is string => part !== undefined).join(" ");

const renderCreateTableStatement = (table: PostgresTableDefinition): string => {
  const tableConstraints = [
    `CONSTRAINT ${table.name}_pkey PRIMARY KEY (${renderColumns(table.primaryKey)})`,
    ...(table.uniqueConstraints ?? []).map(
      constraint => `CONSTRAINT ${constraint.name} UNIQUE (${renderColumns(constraint.columns)})`,
    ),
    ...(table.checkConstraints ?? []).map(
      constraint => `CONSTRAINT ${constraint.name} CHECK (${constraint.expression})`,
    ),
    ...(table.foreignKeys ?? []).map(renderForeignKeyConstraint),
  ];
  const createBody = [
    ...table.columns.map(renderColumnDefinition),
    ...tableConstraints,
  ].map(line => `  ${line}`).join(",\n");

  return `CREATE TABLE ${table.name} (\n${createBody}\n);`;
};

const renderIndexStatement = (
  tableName: string,
  index: PostgresIndexDefinition,
): string => [
  `CREATE ${index.unique === true ? "UNIQUE " : ""}INDEX ${index.name}`,
  `ON ${tableName}`,
  index.using === undefined ? undefined : `USING ${index.using}`,
  `(${renderColumns(index.columns)})`,
  index.where === undefined ? undefined : `WHERE ${index.where}`,
].filter((part): part is string => part !== undefined).join(" ") + ";";

const renderDeferredForeignKeyStatement = (
  foreignKey: PostgresDeferredForeignKeyDefinition,
): string =>
  `ALTER TABLE ${foreignKey.table} ADD ${renderForeignKeyConstraint(foreignKey)};`;

const renderMigrationStatements = (
  tables: readonly PostgresTableDefinition[],
  deferredForeignKeys: readonly PostgresDeferredForeignKeyDefinition[],
): readonly string[] => [
  ...tables.map(renderCreateTableStatement),
  ...tables.flatMap(table => (table.indexes ?? []).map(index => renderIndexStatement(table.name, index))),
  ...deferredForeignKeys.map(renderDeferredForeignKeyStatement),
];

export const platformPostgresMigrationStatements = renderMigrationStatements(
  platformPostgresTables,
  platformPostgresDeferredForeignKeys,
);

export const platformPostgresSchema: PostgresSchemaContract = {
  tables: platformPostgresTables,
  deferredForeignKeys: platformPostgresDeferredForeignKeys,
  statements: platformPostgresMigrationStatements,
};
