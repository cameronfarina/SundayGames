import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomsTable: PostgresTableDefinition = {
  name: "draft_rooms",
  columns: [
    { name: "id", type: "text" },
    { name: "league_id", type: "text" },
    { name: "league_season_id", type: "text" },
    { name: "room_type", type: "text" },
    { name: "status", type: "text" },
    { name: "created_by_user_id", type: "text" },
    { name: "active_model_run_id", type: "text", nullable: true },
    { name: "active_pricing_snapshot_id", type: "text", nullable: true },
    { name: "current_revision", type: "integer", default: "1" },
    { name: "starts_at", type: "timestamptz", nullable: true },
    { name: "started_at", type: "timestamptz", nullable: true },
    { name: "ended_at", type: "timestamptz", nullable: true },
    ...timestamps,
  ],
  primaryKey: ["id"],
  checkConstraints: [
    { name: "draft_rooms_room_type_check", expression: "room_type IN ('real', 'practice')" },
    { name: "draft_rooms_status_check", expression: "status IN ('setup', 'countdown', 'live', 'paused', 'ended')" },
    { name: "draft_rooms_current_revision_check", expression: "current_revision > 0" },
  ],
  foreignKeys: [
    {
      name: "draft_rooms_league_id_fkey",
      columns: ["league_id"],
      references: { table: "leagues", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_rooms_league_season_id_fkey",
      columns: ["league_season_id"],
      references: { table: "league_seasons", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_rooms_created_by_user_id_fkey",
      columns: ["created_by_user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "RESTRICT",
    },
    {
      name: "draft_rooms_active_model_run_id_fkey",
      columns: ["active_model_run_id"],
      references: { table: "model_runs", columns: ["id"] },
      onDelete: "SET NULL",
    },
    {
      name: "draft_rooms_active_pricing_snapshot_id_fkey",
      columns: ["active_pricing_snapshot_id"],
      references: { table: "pricing_snapshots", columns: ["id"] },
      onDelete: "SET NULL",
    },
  ],
  indexes: [
    {
      name: "draft_rooms_real_season_key",
      columns: ["league_season_id"],
      unique: true,
      where: "room_type = 'real'",
    },
    { name: "draft_rooms_league_season_status_idx", columns: ["league_season_id", "status"] },
  ],
};
