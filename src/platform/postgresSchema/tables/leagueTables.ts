import { jsonbArrayDefault, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const leagueTables: readonly PostgresTableDefinition[] = [
  {
    name: "leagues",
    columns: [
      { name: "id", type: "text" },
      { name: "name", type: "text" },
      { name: "sport", type: "text", default: "'football'" },
      { name: "provider", type: "text", nullable: true },
      { name: "provider_league_id", type: "text", nullable: true },
      { name: "created_by_user_id", type: "text" },
      { name: "archived_at", type: "timestamptz", nullable: true },
      { name: "archived_by_user_id", type: "text", nullable: true },
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
      {
        name: "leagues_archived_by_user_id_fkey",
        columns: ["archived_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "leagues_created_by_user_id_idx", columns: ["created_by_user_id"] },
      {
        name: "leagues_active_created_by_user_id_idx",
        columns: ["created_by_user_id"],
        where: "archived_at IS NULL",
      },
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
      { name: "abbreviation", type: "text", nullable: true },
      { name: "manager_names_json", type: "jsonb", default: jsonbArrayDefault },
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
      {
        name: "fantasy_teams_season_owner_user_key",
        columns: ["league_season_id", "owner_user_id"],
        unique: true,
        where: "owner_user_id IS NOT NULL",
      },
      { name: "fantasy_teams_owner_user_id_idx", columns: ["owner_user_id"] },
    ],
  },
  {
    name: "roster_rule_sets",
    columns: [
      { name: "id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "draft_format", type: "text", default: "'auction'" },
      { name: "budget", type: "integer", nullable: true },
      { name: "minimum_bid", type: "integer", nullable: true },
      { name: "snake_json", type: "jsonb", nullable: true },
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
      { name: "roster_rule_sets_draft_format_check", expression: "draft_format IN ('auction', 'snake')" },
      {
        name: "roster_rule_sets_format_settings_check",
        expression: "(draft_format = 'auction' AND budget IS NOT NULL AND minimum_bid IS NOT NULL AND budget > 0 AND minimum_bid > 0 AND snake_json IS NULL) OR (draft_format = 'snake' AND budget IS NULL AND minimum_bid IS NULL AND snake_json IS NOT NULL)",
      },
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
];
