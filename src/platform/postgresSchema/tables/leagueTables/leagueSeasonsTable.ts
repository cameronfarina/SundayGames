import { jsonbDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const leagueSeasonsTable: PostgresTableDefinition = {
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
    {
      name: "league_seasons_status_check",
      expression: "status IN ('draft', 'published', 'locked')",
    },
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
};
