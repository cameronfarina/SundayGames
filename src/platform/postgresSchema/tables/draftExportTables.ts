import { createdAtColumn, jsonbDefault } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const draftExportTables: readonly PostgresTableDefinition[] = [
  {
    name: "draft_room_exports",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "created_by_user_id", type: "text" },
      { name: "job_id", type: "text", nullable: true },
      { name: "artifact_type", type: "text" },
      { name: "status", type: "text" },
      { name: "storage_key", type: "text", nullable: true },
      { name: "payload_hash", type: "text" },
      { name: "content_type", type: "text" },
      { name: "byte_length", type: "integer" },
      { name: "source_revision", type: "integer" },
      { name: "metadata_json", type: "jsonb", default: jsonbDefault },
      { name: "created_at", type: "timestamptz", default: "now()" },
      { name: "completed_at", type: "timestamptz", nullable: true },
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "draft_room_exports_artifact_type_check", expression: "artifact_type IN ('xlsx', 'csv')" },
      { name: "draft_room_exports_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed')" },
      { name: "draft_room_exports_byte_length_check", expression: "byte_length >= 0" },
      { name: "draft_room_exports_source_revision_check", expression: "source_revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_exports_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_exports_created_by_user_id_fkey",
        columns: ["created_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_exports_job_id_fkey",
        columns: ["job_id"],
        references: { table: "jobs", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "draft_room_exports_completed_revision_artifact_key",
        columns: ["draft_room_id", "source_revision", "artifact_type"],
        unique: true,
        where: "status = 'completed'",
      },
      { name: "draft_room_exports_league_season_status_idx", columns: ["league_season_id", "status"] },
    ],
  },
  {
    name: "draft_room_export_contents",
    columns: [
      { name: "id", type: "text" },
      { name: "artifact_id", type: "text" },
      { name: "content_base64", type: "text" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_export_contents_artifact_key", columns: ["artifact_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_export_contents_content_not_blank", expression: "length(trim(content_base64)) > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_export_contents_artifact_id_fkey",
        columns: ["artifact_id"],
        references: { table: "draft_room_exports", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
];
