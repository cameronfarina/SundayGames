import { jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const draftCoreTables: readonly PostgresTableDefinition[] = [
  {
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
  },
  {
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
  },
  {
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
  },
];
