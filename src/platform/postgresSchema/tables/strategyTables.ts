import { createdAtColumn, jsonbArrayDefault, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const strategyTables: readonly PostgresTableDefinition[] = [
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
];
