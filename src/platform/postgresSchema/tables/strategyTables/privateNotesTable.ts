import { jsonbArrayDefault, jsonbDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const privateNotesTable: PostgresTableDefinition = {
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
};
