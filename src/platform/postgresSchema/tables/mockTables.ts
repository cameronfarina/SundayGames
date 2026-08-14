import { createdAtColumn, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const mockTables: readonly PostgresTableDefinition[] = [
  {
    name: "mock_sessions",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "owner_id", type: "text" },
      { name: "team_id", type: "text" },
      { name: "model_run_id", type: "text", nullable: true },
      { name: "pricing_snapshot_id", type: "text", nullable: true },
      { name: "status", type: "text" },
      { name: "revision", type: "integer", default: "1" },
      { name: "command_count", type: "integer", default: "0" },
      { name: "seed", type: "text", nullable: true },
      { name: "draft_mode_json", type: "jsonb", default: jsonbDefault },
      { name: "latest_result_ref_json", type: "jsonb", nullable: true },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      { name: "abandoned_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "mock_sessions_status_check", expression: "status IN ('setup', 'active', 'completed', 'abandoned')" },
      { name: "mock_sessions_revision_check", expression: "revision > 0" },
      { name: "mock_sessions_command_count_check", expression: "command_count >= 0" },
    ],
    foreignKeys: [
      {
        name: "mock_sessions_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "mock_sessions_team_id_fkey",
        columns: ["team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "mock_sessions_model_run_id_fkey",
        columns: ["model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "mock_sessions_pricing_snapshot_id_fkey",
        columns: ["pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "mock_sessions_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      { name: "mock_sessions_owner_team_idx", columns: ["league_season_id", "owner_id", "team_id"] },
    ],
  },
  {
    name: "mock_session_events",
    columns: [
      { name: "id", type: "text" },
      { name: "mock_session_id", type: "text" },
      { name: "revision", type: "integer" },
      { name: "sequence", type: "integer" },
      { name: "event_type", type: "text" },
      { name: "command_id", type: "text", nullable: true },
      { name: "command", type: "text", nullable: true },
      { name: "payload_json", type: "jsonb", default: jsonbDefault },
      { name: "idempotency_key", type: "text", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "mock_session_events_sequence_key", columns: ["mock_session_id", "sequence"] },
    ],
    checkConstraints: [
      { name: "mock_session_events_revision_check", expression: "revision > 0" },
      { name: "mock_session_events_sequence_check", expression: "sequence > 0" },
    ],
    foreignKeys: [
      {
        name: "mock_session_events_mock_session_id_fkey",
        columns: ["mock_session_id"],
        references: { table: "mock_sessions", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      {
        name: "mock_session_events_revision_idempotency_key",
        columns: ["mock_session_id", "revision", "idempotency_key"],
        unique: true,
        where: "idempotency_key IS NOT NULL",
      },
      { name: "mock_session_events_session_created_at_idx", columns: ["mock_session_id", "created_at"] },
    ],
  },
];
