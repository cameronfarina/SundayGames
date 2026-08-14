import { createdAtColumn } from "../../columns.js";
import type { PostgresTableDefinition } from "../../types.js";

export const pricingSnapshotsTable: PostgresTableDefinition = {
  name: "pricing_snapshots",
  columns: [
    { name: "id", type: "text" },
    { name: "model_run_id", type: "text" },
    { name: "league_season_id", type: "text" },
    { name: "scenario_id", type: "text" },
    { name: "snapshot_hash", type: "text" },
    createdAtColumn,
  ],
  primaryKey: ["id"],
  uniqueConstraints: [
    { name: "pricing_snapshots_model_run_scenario_key", columns: ["model_run_id", "scenario_id"] },
    { name: "pricing_snapshots_snapshot_hash_key", columns: ["snapshot_hash"] },
  ],
  foreignKeys: [
    {
      name: "pricing_snapshots_model_run_id_fkey",
      columns: ["model_run_id"],
      references: { table: "model_runs", columns: ["id"] },
      onDelete: "CASCADE",
    },
    {
      name: "pricing_snapshots_league_season_id_fkey",
      columns: ["league_season_id"],
      references: { table: "league_seasons", columns: ["id"] },
      onDelete: "CASCADE",
    },
  ],
  indexes: [
    { name: "pricing_snapshots_league_season_idx", columns: ["league_season_id"] },
  ],
};
