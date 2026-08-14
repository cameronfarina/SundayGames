import { createdAtColumn, jsonbDefault, timestamps } from "../columns.js";
import type { PostgresTableDefinition } from "../types.js";

export const simulationTables: readonly PostgresTableDefinition[] = [
  {
    name: "simulation_runs",
    columns: [
      { name: "id", type: "text" },
      { name: "league_id", type: "text" },
      { name: "league_season_id", type: "text" },
      { name: "user_id", type: "text" },
      { name: "job_id", type: "text", nullable: true },
      { name: "model_run_id", type: "text", nullable: true },
      { name: "pricing_snapshot_id", type: "text", nullable: true },
      { name: "strategy_plan_version_id", type: "text", nullable: true },
      { name: "owner_id", type: "text" },
      { name: "team_id", type: "text" },
      { name: "idempotency_key", type: "text" },
      { name: "input_hash", type: "text" },
      { name: "request_json", type: "jsonb", default: jsonbDefault },
      { name: "status", type: "text" },
      { name: "started_at", type: "timestamptz", nullable: true },
      { name: "completed_at", type: "timestamptz", nullable: true },
      ...timestamps,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "simulation_runs_user_league_season_idempotency_key", columns: ["user_id", "league_id", "league_season_id", "idempotency_key"] },
    ],
    checkConstraints: [
      { name: "simulation_runs_status_check", expression: "status IN ('requested', 'queued', 'running', 'completed', 'failed', 'canceled')" },
    ],
    foreignKeys: [
      {
        name: "simulation_runs_league_id_fkey",
        columns: ["league_id"],
        references: { table: "leagues", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_league_season_id_fkey",
        columns: ["league_season_id"],
        references: { table: "league_seasons", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_user_id_fkey",
        columns: ["user_id"],
        references: { table: "accounts", columns: ["id"] },
        onDelete: "CASCADE",
      },
      {
        name: "simulation_runs_job_id_fkey",
        columns: ["job_id"],
        references: { table: "jobs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_model_run_id_fkey",
        columns: ["model_run_id"],
        references: { table: "model_runs", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_pricing_snapshot_id_fkey",
        columns: ["pricing_snapshot_id"],
        references: { table: "pricing_snapshots", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_strategy_plan_version_id_fkey",
        columns: ["strategy_plan_version_id"],
        references: { table: "strategy_plan_versions", columns: ["id"] },
        onDelete: "SET NULL",
      },
      {
        name: "simulation_runs_team_id_fkey",
        columns: ["team_id"],
        references: { table: "fantasy_teams", columns: ["id"] },
        onDelete: "RESTRICT",
      },
    ],
    indexes: [
      { name: "simulation_runs_private_owner_idx", columns: ["user_id", "league_season_id", "status"] },
      {
        name: "simulation_runs_job_id_key",
        columns: ["job_id"],
        unique: true,
        where: "job_id IS NOT NULL",
      },
    ],
  },
  {
    name: "simulation_results",
    columns: [
      { name: "id", type: "text" },
      { name: "simulation_run_id", type: "text" },
      { name: "summary_json", type: "jsonb", default: jsonbDefault },
      { name: "result_set_json", type: "jsonb", default: jsonbDefault },
      createdAtColumn,
    ],
    primaryKey: ["id"],
    uniqueConstraints: [
      { name: "simulation_results_run_key", columns: ["simulation_run_id"] },
    ],
    foreignKeys: [
      {
        name: "simulation_results_simulation_run_id_fkey",
        columns: ["simulation_run_id"],
        references: { table: "simulation_runs", columns: ["id"] },
        onDelete: "CASCADE",
      },
    ],
  },
];
