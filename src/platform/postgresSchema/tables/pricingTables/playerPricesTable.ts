import { createdAtColumn, jsonbArrayDefault, jsonbDefault } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const playerPricesTable: PostgresTableDefinition = {
  name: "player_prices",
  columns: [
    { name: "id", type: "text" },
    { name: "pricing_snapshot_id", type: "text" },
    { name: "player_id", type: "text", nullable: true },
    { name: "player_key", type: "text" },
    { name: "player_name", type: "text" },
    { name: "normalized_name", type: "text" },
    { name: "position", type: "text" },
    { name: "market_price", type: "integer" },
    { name: "scenario_price", type: "integer" },
    { name: "live_price", type: "integer" },
    { name: "personal_value", type: "integer" },
    { name: "recommended_max_bid", type: "integer" },
    { name: "warnings_json", type: "jsonb", default: jsonbArrayDefault },
    { name: "confidence", type: "numeric", nullable: true },
    { name: "tier", type: "text", nullable: true },
    { name: "strategy_overlay_id", type: "text", nullable: true },
    { name: "explanation_json", type: "jsonb", default: jsonbDefault },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "player_prices_snapshot_player_key", columns: ["pricing_snapshot_id", "player_key"] },
  ],
  checkConstraints: [
    { name: "player_prices_non_negative_check", expression: "market_price >= 0 AND scenario_price >= 0 AND live_price >= 0 AND personal_value >= 0 AND recommended_max_bid >= 0" },
    { name: "player_prices_position_check", expression: "position IN ('QB', 'RB', 'WR', 'TE', 'K', 'DST')" },
    { name: "player_prices_confidence_check", expression: "confidence IS NULL OR confidence BETWEEN 0 AND 1" },
  ],
  foreignKeys: [
    {
      name: "player_prices_pricing_snapshot_id_fkey",
      columns: ["pricing_snapshot_id"],
      references: { table: "pricing_snapshots", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "player_prices_player_id_fkey",
      columns: ["player_id"],
      references: { table: "players", columns: ["id"] },
      onDelete: "SET NULL",
    },
  ],
  indexes: [
    { name: "player_prices_player_id_idx", columns: ["player_id"] },
  ],
};
