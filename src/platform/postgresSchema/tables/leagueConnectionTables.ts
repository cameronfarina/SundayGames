import { createdAtColumn, jsonbArrayDefault, jsonbDefault, updatedAtColumn } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const leagueConnectionTables: readonly PostgresTableDefinition[] = [
  {
    name: "league_connections",
    columns: [
      { name: "id", type: "text" },
      { name: "account_id", type: "text" },
      { name: "provider", type: "text" },
      { name: "provider_league_id", type: "text" },
      { name: "season", type: "text" },
      { name: "display_name", type: "text" },
      { name: "status", type: "text" },
      { name: "status_detail", type: "text", nullable: true },
      { name: "espn_s2", type: "text", nullable: true },
      { name: "swid", type: "text", nullable: true },
      { name: "credentials_ciphertext", type: "text", nullable: true },
      { name: "credentials_key_id", type: "text", nullable: true },
      { name: "last_synced_at", type: "timestamptz", nullable: true },
      { name: "league_season_id", type: "text", nullable: true },
      { name: "sync_revision", type: "bigint", default: "0" },
      createdAtColumn,
      updatedAtColumn,
    ],
    primaryKey: ["id"],
    foreignKeys: [
      {
        name: "league_connections_account_id_fkey",
        columns: ["account_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      // Deleting the imported league unlinks the connection; it must not take
      // the connection and its snapshot with it.
      {
        name: "league_connections_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    checkConstraints: [
      {
        name: "league_connections_provider_check",
        expression: "provider IN ('sleeper', 'espn', 'yahoo')",
      },
      {
        name: "league_connections_status_check",
        expression: "status IN ('pending', 'ok', 'needs_attention', 'error')",
      },
      {
        name: "league_connections_encrypted_credentials_pair_check",
        expression: "(credentials_ciphertext IS NULL) = (credentials_key_id IS NULL)",
      },
    ],
    indexes: [
      {
        name: "league_connections_account_league_key",
        columns: ["account_id", "provider", "provider_league_id", "season"],
        unique: true,
      },
      { name: "league_connections_account_id_idx", columns: ["account_id"] },
    ],
  },
  {
    name: "league_connection_snapshots",
    columns: [
      { name: "connection_id", type: "text" },
      { name: "settings_json", type: "jsonb", default: jsonbDefault },
      { name: "teams_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "matchups_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "synced_at", type: "timestamptz" },
      { name: "sync_revision", type: "bigint", default: "0" },
      createdAtColumn,
    ],
    primaryKey: ["connection_id"],
    foreignKeys: [
      {
        name: "league_connection_snapshots_connection_id_fkey",
        columns: ["connection_id"],
        references: { table: "league_connections", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
  {
    name: "provider_player_directories",
    columns: [
      { name: "provider", type: "text" },
      { name: "entries_json", type: "jsonb", default: jsonbDefault },
      { name: "fetched_at", type: "timestamptz" },
      createdAtColumn,
    ],
    primaryKey: ["provider"],
  },
];
