import { jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const jobTables: readonly PostgresTableDefinition[] = [
  {
    name: "jobs",
    columns: [
      { name: "id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "kind", type: "text" },
      { name: "status", type: "text" },
      { name: "idempotency_key", type: "text" },
      { name: "input_hash", type: "text" },
      { name: "input_json", type: "jsonb", default: jsonbDefault },
      { name: "progress_json", type: "jsonb", default: jsonbDefault },
      { name: "result_summary_json", type: "jsonb", nullable: true },
      { name: "attempt_count", type: "integer", default: "0" },
      { name: "max_attempts", type: "integer", default: "3" },
      { name: "locked_by", type: "text", nullable: true },
      { name: "locked_at", type: "timestamptz", nullable: true },
      { name: "heartbeat_at", type: "timestamptz", nullable: true },
      { name: "lock_expires_at", type: "timestamptz", nullable: true },
      { name: "available_at", type: "timestamptz", default: "now()" },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "finished_at", type: "timestamptz", nullable: true },
      { name: "cancellation_requested_at", type: "timestamptz", nullable: true },
      { name: "sanitized_error_json", type: "jsonb", nullable: true },
      { name: "error_summary", type: "text", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "jobs_user_league_season_idempotency_key", columns: ["user_id", "league_id", "league_season_id", "idempotency_key"] },
    ],
    checkConstraints: [
      { name: "jobs_kind_check", expression: "kind IN ('import', 'model_run', 'simulation', 'season_simulation', 'export', 'maintenance')" },
      { name: "jobs_status_check", expression: "status IN ('queued', 'running', 'completed', 'failed', 'canceled')" },
      { name: "jobs_attempts_check", expression: "attempt_count >= 0 AND max_attempts > 0" },
    ],
    foreignKeys: [
      {
        name: "jobs_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "jobs_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "jobs_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "jobs_claimable_idx", columns: ["status", "available_at", "created_at"] },
      { name: "jobs_expired_lease_idx", columns: ["status", "lock_expires_at"] },
      { name: "jobs_locked_by_locked_at_idx", columns: ["locked_by", "locked_at"] },
      { name: "jobs_user_status_idx", columns: ["user_id", "status"] },
      { name: "jobs_kind_user_started_at_idx", columns: ["kind", "user_id", "started_at"] },
    ],
  },
  {
    name: "platform_worker_heartbeats",
    columns: [
      { name: "worker_id", type: "text" },
      { name: "job_kinds_json", type: "jsonb", default: jsonbDefault },
      { name: "started_at", type: "timestamptz" },
      { name: "last_seen_at", type: "timestamptz" },
    ],
    primaryKey: ["worker_id"],
    indexes: [
      { name: "platform_worker_heartbeats_last_seen_at_idx", columns: ["last_seen_at"] },
    ],
  },
];
