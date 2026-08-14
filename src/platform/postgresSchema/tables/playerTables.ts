import { createdAtColumn, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const playerTables: readonly PostgresTableDefinition[] = [
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
];
