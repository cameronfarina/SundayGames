import { jsonbArrayDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const fantasyTeamsTable: PostgresTableDefinition = {
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
    {
      name: "fantasy_teams_season_display_order_key",
      columns: ["league_season_id", "display_order"],
    },
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
};
