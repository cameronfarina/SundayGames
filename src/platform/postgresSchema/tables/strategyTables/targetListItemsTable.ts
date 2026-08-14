import { jsonbArrayDefault, jsonbDefault, timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const targetListItemsTable: PostgresTableDefinition = {
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
};
