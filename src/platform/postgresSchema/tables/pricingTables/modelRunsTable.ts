import { createdAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const modelRunsTable: PostgresTableDefinition = {
  name: "model_runs",
  columns: [
    { name: "id", type: "text" },
    { name: "league_id", type: "text" },
    { name: "league_season_id", type: "text" },
    { name: "model_version", type: "text" },
    { name: "input_snapshot_id", type: "text" },
    { name: "input_hash", type: "text" },
    { name: "status", type: "text" },
    { name: "created_by_user_id", type: "text" },
    { name: "started_at", type: "timestamptz", nullable: true },
    { name: "completed_at", type: "timestamptz", nullable: true },
    { name: "error_summary", type: "text", nullable: true },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "model_runs_input_identity_key", columns: ["league_season_id", "model_version", "input_hash"] },
  ],
  checkConstraints: [
    { name: "model_runs_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed', 'canceled')" },
  ],
  foreignKeys: [
    {
      name: "model_runs_league_id_fkey",
      columns: ["league_id"],
      references: { table: "leagues", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "model_runs_league_season_id_fkey",
      columns: ["league_season_id"],
      references: { table: "league_seasons", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "model_runs_created_by_user_id_fkey",
      columns: ["created_by_user_id"],
      references: { table: "accounts", columns: ["id"] },
      onDelete: "RESTRICT",
    },
  ],
  indexes: [
    { name: "model_runs_league_season_status_idx", columns: ["league_season_id", "status"] },
  ],
};
