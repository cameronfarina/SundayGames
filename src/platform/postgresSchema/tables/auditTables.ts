import { createdAtColumn, jsonbDefault } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const auditTables: readonly PostgresTableDefinition[] = [
  {
    name: "audit_events",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text", nullable: true },
      { name: "user_id", type: "text", nullable: true },
      { name: "event_type", type: "text" },
      { name: "resource_type", type: "text" },
      { name: "resource_id", type: "text" },
      { name: "metadata_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    foreignKeys: [
      {
        name: "audit_events_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "audit_events_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "audit_events_league_created_at_idx", columns: ["league_id", "created_at"] },
      { name: "audit_events_user_created_at_idx", columns: ["user_id", "created_at"] },
    ],
  },
];
