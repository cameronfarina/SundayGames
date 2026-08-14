import { timestamps } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomParticipantsTable: PostgresTableDefinition = {
  name: "draft_room_participants",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "user_id", type: "text" },
    { name: "selected_team_id", type: "text", nullable: true },
    { name: "role", type: "text" },
    { name: "last_seen_revision", type: "integer", default: "0" },
    { name: "connected_at", type: "timestamptz", nullable: true },
    { name: "disconnected_at", type: "timestamptz", nullable: true },
    ...timestamps,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "draft_room_participants_room_user_key", columns: ["draft_room_id", "user_id"] },
  ],
  checkConstraints: [
    { name: "draft_room_participants_role_check", expression: "role IN ('commissioner', 'admin', 'member', 'observer')" },
    { name: "draft_room_participants_last_seen_revision_check", expression: "last_seen_revision >= 0" },
  ],
  foreignKeys: [
    {
      name: "draft_room_participants_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_participants_user_id_fkey",
      columns: ["user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_participants_selected_team_id_fkey",
      columns: ["selected_team_id"],
      references: { table: "fantasy_teams", columns: ["id"] },
      onDelete: "SET NULL",
    },
  ],
  indexes: [
    { name: "draft_room_participants_room_team_idx", columns: ["draft_room_id", "selected_team_id"] },
  ],
};
