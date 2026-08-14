import { jsonbDefault } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const draftRoomEventsTable: PostgresTableDefinition = {
  name: "draft_room_events",
  columns: [
    { name: "id", type: "text" },
    { name: "draft_room_id", type: "text" },
    { name: "revision", type: "integer" },
    { name: "sequence", type: "integer" },
    { name: "event_type", type: "text" },
    { name: "actor_user_id", type: "text" },
    { name: "idempotency_key", type: "text", nullable: true },
    { name: "mutation_hash", type: "text", nullable: true },
    { name: "expected_revision", type: "integer", nullable: true },
    { name: "raw_command", type: "text", nullable: true },
    { name: "payload_json", type: "jsonb", default: jsonbDefault },
    { name: "validation_json", type: "jsonb", default: jsonbDefault },
    { name: "occurred_at", type: "timestamptz" },
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "draft_room_events_room_revision_key", columns: ["draft_room_id", "revision"] },
    { name: "draft_room_events_room_sequence_key", columns: ["draft_room_id", "sequence"] },
  ],
  checkConstraints: [
    { name: "draft_room_events_revision_check", expression: "revision > 0" },
    { name: "draft_room_events_sequence_check", expression: "sequence > 0" },
  ],
  foreignKeys: [
    {
      name: "draft_room_events_draft_room_id_fkey",
      columns: ["draft_room_id"],
      references: { table: "draft_rooms", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "draft_room_events_actor_user_id_fkey",
      columns: ["actor_user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "RESTRICT",
    },
  ],
  indexes: [
    {
      name: "draft_room_events_mutation_idempotency_key",
      columns: ["draft_room_id", "idempotency_key"],
      unique: true,
      where: "idempotency_key IS NOT NULL",
    },
    { name: "draft_room_events_room_occurred_at_idx", columns: ["draft_room_id", "occurred_at"] },
  ],
};
