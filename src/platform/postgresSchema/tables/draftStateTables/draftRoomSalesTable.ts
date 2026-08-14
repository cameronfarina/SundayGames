import { createdAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomSalesTable: PostgresTableDefinition = {
  name: "draft_room_sales",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "source_event_id", type: "text" },
    { name: "fantasy_team_id", type: "text" },
    { name: "player_id", type: "text", nullable: true },
    { name: "player_name", type: "text" },
    { name: "normalized_player_name", type: "text" },
    { name: "position", type: "text" },
    { name: "price", type: "integer" },
    { name: "expected_price", type: "integer", nullable: true },
    { name: "live_price", type: "integer", nullable: true },
    { name: "status", type: "text" },
    { name: "voided_by_event_id", type: "text", nullable: true },
    { name: "corrected_by_event_id", type: "text", nullable: true },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "draft_room_sales_source_event_key", columns: ["source_event_id"] },
  ],
  checkConstraints: [
    { name: "draft_room_sales_price_check", expression: "price > 0" },
    {
      name: "draft_room_sales_status_check",
      expression: "status IN ('active', 'voided', 'corrected')",
    },
  ],
  foreignKeys: [
    {
      name: "draft_room_sales_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_sales_source_event_id_fkey",
      columns: ["source_event_id"],
      references: { table: "draft_room_events", columns: ["id"] },
      onDelete: "RESTRICT",
    },
    {
      name: "draft_room_sales_fantasy_team_id_fkey",
      columns: ["fantasy_team_id"],
      references: { table: "fantasy_teams", columns: ["id"] },
      onDelete: "RESTRICT",
    },
    {
      name: "draft_room_sales_player_id_fkey",
      columns: ["player_id"],
      references: { table: "players", columns: ["id"] },
      onDelete: "SET NULL",
    },
    {
      name: "draft_room_sales_voided_by_event_id_fkey",
      columns: ["voided_by_event_id"],
      references: { table: "draft_room_events", columns: ["id"] },
      onDelete: "SET NULL",
    },
    {
      name: "draft_room_sales_corrected_by_event_id_fkey",
      columns: ["corrected_by_event_id"],
      references: { table: "draft_room_events", columns: ["id"] },
      onDelete: "SET NULL",
    },
  ],
  indexes: [
    {
      name: "draft_room_sales_active_player_key",
      columns: ["draft_room_id", "player_id"],
      unique: true,
      where: "status = 'active' AND player_id IS NOT NULL",
    },
    {
      name: "draft_room_sales_active_normalized_player_key",
      columns: ["draft_room_id", "normalized_player_name"],
      unique: true,
      where: "status = 'active'",
    },
    {
      name: "draft_room_sales_room_team_idx",
      columns: ["draft_room_id", "fantasy_team_id"],
    },
  ],
};
