import { createdAtColumn, jsonbDefault } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomSnapshotsTable: PostgresTableDefinition = {
  name: "draft_room_snapshots",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "revision", type: "integer" },
    { name: "snapshot_json", type: "jsonb", default: jsonbDefault },
    { name: "snapshot_hash", type: "text" },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    {
      name: "draft_room_snapshots_room_revision_key",
      columns: ["draft_room_id", "revision"],
    },
  ],
  checkConstraints: [
    { name: "draft_room_snapshots_revision_check", expression: "revision > 0" },
  ],
  foreignKeys: [
    {
      name: "draft_room_snapshots_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
  indexes: [
    {
      name: "draft_room_snapshots_room_hash_idx",
      columns: ["draft_room_id", "snapshot_hash"],
    },
  ],
};
