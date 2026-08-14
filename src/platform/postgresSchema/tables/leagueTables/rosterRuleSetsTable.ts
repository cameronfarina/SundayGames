import { jsonbDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const rosterRuleSetsTable: PostgresTableDefinition = {
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
    {
      name: "roster_rule_sets_draft_format_check",
      expression: "draft_format IN ('auction', 'snake')",
    },
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
};
