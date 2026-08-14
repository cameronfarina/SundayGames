import { createdAtColumn, jsonbArrayDefault, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const pricingTables: readonly PostgresTableDefinition[] = [
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
    name: "league_season_draft_setups",
    columns: [
      { name: "league_season_id", type: "text" },
      { name: "source_version", type: "text" },
      { name: "player_catalog_json", type: "jsonb" },
      { name: "initial_rosters_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "content_hash", type: "text" },
      ...timestamps,
    ],
    primaryKey: ["league_season_id"],
    checkConstraints: [
      { name: "league_season_draft_setups_catalog_array_check", expression: "jsonb_typeof(player_catalog_json) = 'array'" },
      { name: "league_season_draft_setups_rosters_array_check", expression: "jsonb_typeof(initial_rosters_json) = 'array'" },
    ],
    foreignKeys: [
      {
        name: "league_season_draft_setups_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
];
