import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "../postgresPlatformStore.js";

export interface PostgresTransactionalQueryClient extends PostgresQueryClient {
  transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T>;
}

export interface JobRow {
  id: string;
  user_id: string;
  league_id: string;
  league_season_id: string;
  kind: string;
  status: string;
  idempotency_key: string;
  input_hash: string;
  input_json: unknown;
  progress_json: unknown;
  result_summary_json: unknown;
  attempt_count: number;
  max_attempts: number;
  locked_by: string | null;
  locked_at: Date | string | null;
  heartbeat_at: Date | string | null;
  lock_expires_at: Date | string | null;
  started_at: Date | string | null;
  finished_at: Date | string | null;
  cancellation_requested_at: Date | string | null;
  sanitized_error_json: unknown;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface JobQueueContext {
  client: PostgresTransactionalQueryClient;
}

export const firstRow = <TRow>(
  result: PostgresQueryResult<TRow>,
): TRow | undefined => result.rows[0];
