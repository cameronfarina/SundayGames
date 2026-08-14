import type { PostgresDeferredForeignKeyDefinition } from "./types.js";

export const platformPostgresDeferredForeignKeys: readonly PostgresDeferredForeignKeyDefinition[] = [
  {
    table: "league_seasons",
    name: "league_seasons_active_model_run_id_fkey",
    columns: ["active_model_run_id"],
    references: { table: "model_runs", columns: ["id"] },
    onDelete: "SET NULL",
  },
  {
    table: "league_seasons",
    name: "league_seasons_active_pricing_snapshot_id_fkey",
    columns: ["active_pricing_snapshot_id"],
    references: { table: "pricing_snapshots", columns: ["id"] },
    onDelete: "SET NULL",
  },
  {
    table: "strategy_plans",
    name: "strategy_plans_current_version_id_fkey",
    columns: ["current_version_id"],
    references: { table: "strategy_plan_versions", columns: ["id"] },
    onDelete: "SET NULL",
  },
];
