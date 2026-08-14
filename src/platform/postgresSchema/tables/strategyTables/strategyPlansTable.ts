import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const strategyPlansTable: PostgresTableDefinition = {
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
};
