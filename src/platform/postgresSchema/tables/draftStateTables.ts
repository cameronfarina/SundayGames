import { createdAtColumn, jsonbArrayDefault, jsonbDefault, updatedAtColumn } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const draftStateTables: readonly PostgresTableDefinition[] = [
  {
    name: "draft_room_sales",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "source_event_id", type: "text" },
      { name: "fantasy_team_id", type: "text" },
      { name: "player_id", type: "text", nullable: true },
      { name: "player_name", type: "text" },
      { name: "normalized_player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "price", type: "integer" },
      { name: "expected_price", type: "integer", nullable: true },
      { name: "live_price", type: "integer", nullable: true },
      { name: "status", type: "text" },
      { name: "voided_by_event_id", type: "text", nullable: true },
      { name: "corrected_by_event_id", type: "text", nullable: true },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_sales_source_event_key", columns: ["source_event_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_sales_price_check", expression: "price > 0" },
      { name: "draft_room_sales_status_check", expression: "status IN ('active', 'voided', 'corrected')" },
    ],
    foreignKeys: [
      {
        name: "draft_room_sales_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_sales_source_event_id_fkey",
        columns: ["source_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_sales_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "draft_room_sales_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "draft_room_sales_voided_by_event_id_fkey",
        columns: ["voided_by_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "draft_room_sales_corrected_by_event_id_fkey",
        columns: ["corrected_by_event_id"],
        references: { table: "draft_room_events", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "draft_room_sales_active_player_key",
        columns: ["draft_room_id", "player_id"],
        unique: true,
        where: "status = 'active' AND player_id IS NOT NULL",
      },
      {
        name: "draft_room_sales_active_normalized_player_key",
        columns: ["draft_room_id", "normalized_player_name"],
        unique: true,
        where: "status = 'active'",
      },
      { name: "draft_room_sales_room_team_idx", columns: ["draft_room_id", "fantasy_team_id"] },
    ],
  },
  {
    name: "draft_room_team_states",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "fantasy_team_id", type: "text" },
      { name: "spent", type: "integer" },
      { name: "remaining_budget", type: "integer" },
      { name: "max_bid", type: "integer" },
      { name: "roster_slots_remaining", type: "integer" },
      { name: "position_counts_json", type: "jsonb", default: jsonbDefault },
      { name: "roster_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "validity_json", type: "jsonb", default: jsonbDefault },
      { name: "revision", type: "integer" },
      updatedAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_team_states_room_team_key", columns: ["draft_room_id", "fantasy_team_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_team_states_non_negative_check", expression: "spent >= 0 AND remaining_budget >= 0 AND max_bid >= 0 AND roster_slots_remaining >= 0" },
      { name: "draft_room_team_states_revision_check", expression: "revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_team_states_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_team_states_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
    indexes: [
      { name: "draft_room_team_states_room_revision_idx", columns: ["draft_room_id", "revision"] },
    ],
  },
  {
    name: "draft_room_player_states",
    columns: [
      { name: "id", type: "text" },
      { name: "draft_room_id", type: "text" },
      { name: "player_id", type: "text" },
      { name: "state", type: "text" },
      { name: "fantasy_team_id", type: "text", nullable: true },
      { name: "price", type: "integer", nullable: true },
      { name: "revision", type: "integer" },
      updatedAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "draft_room_player_states_room_player_key", columns: ["draft_room_id", "player_id"] },
    ],
    checkConstraints: [
      { name: "draft_room_player_states_state_check", expression: "state IN ('available', 'sold', 'keeper', 'unavailable')" },
      { name: "draft_room_player_states_price_check", expression: "price IS NULL OR price >= 0" },
      { name: "draft_room_player_states_revision_check", expression: "revision > 0" },
    ],
    foreignKeys: [
      {
        name: "draft_room_player_states_draft_room_id_fkey",
        columns: ["draft_room_id"],
        references: { table: "draft_rooms", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_player_states_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "draft_room_player_states_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      { name: "draft_room_player_states_room_state_idx", columns: ["draft_room_id", "state"] },
    ],
  },
  {
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
      { name: "draft_room_snapshots_room_revision_key", columns: ["draft_room_id", "revision"] },
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
      { name: "draft_room_snapshots_room_hash_idx", columns: ["draft_room_id", "snapshot_hash"] },
    ],
  },
];
