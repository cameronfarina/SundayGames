import { createdAtColumn, jsonbArrayDefault, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const historyTables: readonly PostgresTableDefinition[] = [
  {
    name: "historical_import_batches",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text", nullable: true },
      { name: "season_year", type: "integer" },
      { name: "uploaded_by_user_id", type: "text" },
      { name: "file_name", type: "text" },
      { name: "file_hash", type: "text" },
      { name: "status", type: "text" },
      { name: "replacement_requested", type: "boolean", default: "false" },
      { name: "mapping_json", type: "jsonb", default: jsonbDefault },
      { name: "warnings_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "blockers_json", type: "jsonb", default: jsonbArrayDefault },
      { name: "committed_at", type: "timestamptz", nullable: true },
      { name: "superseded_at", type: "timestamptz", nullable: true },
      { name: "superseded_by_batch_id", type: "text", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    checkConstraints: [
      { name: "historical_import_batches_status_check", expression: "status IN ('previewed', 'blocked', 'committed', 'superseded')" },
      { name: "historical_import_batches_year_check", expression: "season_year >= 2000" },
    ],
    foreignKeys: [
      {
        name: "historical_import_batches_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_import_batches_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_import_batches_uploaded_by_user_id_fkey",
        columns: ["uploaded_by_user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "RESTRICT",
      },
      {
        name: "historical_import_batches_superseded_by_batch_id_fkey",
        columns: ["superseded_by_batch_id"],
        references: { table: "historical_import_batches", columns: ["id"] },
        onDelete: "SET NULL",
      },
    ],
    indexes: [
      {
        name: "historical_import_batches_file_identity_key",
        columns: ["league_id", "season_year", "file_hash"],
        unique: true,
        where: "superseded_by_batch_id IS NULL",
      },
      {
        name: "historical_import_batches_current_committed_season_key",
        columns: ["league_id", "season_year"],
        unique: true,
        where: "status = 'committed'",
      },
      { name: "historical_import_batches_league_year_status_idx", columns: ["league_id", "season_year", "status"] },
    ],
  },
  {
    name: "historical_draft_sales",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text", nullable: true },
      { name: "season_year", type: "integer" },
      { name: "import_batch_id", type: "text" },
      { name: "fantasy_team_id", type: "text", nullable: true },
      { name: "owner_id", type: "text" },
      { name: "owner_display_name", type: "text" },
      { name: "player_id", type: "text" },
      { name: "player_name", type: "text" },
      { name: "position", type: "text" },
      { name: "price_dollars", type: "integer" },
      { name: "public_price_dollars", type: "integer", nullable: true },
      { name: "keeper", type: "boolean", default: "false" },
      { name: "acquisition_type", type: "text" },
      { name: "row_number", type: "integer" },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "historical_draft_sales_batch_row_key", columns: ["import_batch_id", "row_number"] },
    ],
    checkConstraints: [
      { name: "historical_draft_sales_price_check", expression: "price_dollars >= 0" },
      {
        name: "historical_draft_sales_public_price_check",
        expression: "public_price_dollars IS NULL OR public_price_dollars > 0",
      },
      { name: "historical_draft_sales_row_number_check", expression: "row_number > 0" },
      { name: "historical_draft_sales_acquisition_type_check", expression: "acquisition_type IN ('auction', 'keeper')" },
    ],
    foreignKeys: [
      {
        name: "historical_draft_sales_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_draft_sales_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_draft_sales_import_batch_id_fkey",
        columns: ["import_batch_id"],
        references: { table: "historical_import_batches", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "historical_draft_sales_fantasy_team_id_fkey",
        columns: ["fantasy_team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "historical_draft_sales_player_id_fkey",
        columns: ["player_id"],
        references: { table: "players", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "historical_draft_sales_league_year_idx", columns: ["league_id", "season_year"] },
      { name: "historical_draft_sales_import_batch_idx", columns: ["import_batch_id"] },
      { name: "historical_draft_sales_player_id_idx", columns: ["player_id"] },
    ],
  },
];
