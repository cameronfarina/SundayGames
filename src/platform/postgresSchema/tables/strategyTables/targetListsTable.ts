import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const targetListsTable: PostgresTableDefinition = {
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
};
