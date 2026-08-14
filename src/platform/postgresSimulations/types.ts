import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryResult } from "../postgresPlatformStore.js";

export interface SimulationRunRow {
  id: string;
  league_id: string;
  league_season_id: string;
  user_id: string;
  job_id: string | null;
  model_run_id: string | null;
  pricing_snapshot_id: string | null;
  strategy_plan_version_id: string | null;
  owner_id: string;
  team_id: string;
  idempotency_key: string;
  input_hash: string;
  request_json: unknown;
  status: string;
  started_at: Date | string | null;
  completed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  result_id: string | null;
  summary_json: unknown;
  result_set_json: unknown;
  result_created_at: Date | string | null;
}

export interface SimulationRepositoryContext {
  client: PostgresTransactionalQueryClient;
}

export const firstRow = <TRow>(
  result: PostgresQueryResult<TRow>,
): TRow | undefined => result.rows[0];
