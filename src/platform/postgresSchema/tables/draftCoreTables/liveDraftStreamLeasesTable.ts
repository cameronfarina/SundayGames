import { createdAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const liveDraftStreamLeasesTable: PostgresTableDefinition = {
  name: "live_draft_stream_leases",
  columns: [
    { name: "id", type: "text" },
    { name: "account_id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "expires_at", type: "timestamptz" },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  foreignKeys: [
    {
      name: "live_draft_stream_leases_account_id_fkey",
      columns: ["account_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "live_draft_stream_leases_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
  indexes: [
    {
      name: "live_draft_stream_leases_account_expires_idx",
      columns: ["account_id", "expires_at"],
    },
    { name: "live_draft_stream_leases_expires_at_idx", columns: ["expires_at"] },
  ],
};
