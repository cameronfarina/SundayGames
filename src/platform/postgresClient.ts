import { Pool } from "pg";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";

export interface PostgresPoolQueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  rowCount: number | null;
}

export interface PostgresPoolClientLike {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>>;
  release(): void;
}

export interface PostgresPoolLike {
  options?: unknown;
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>>;
  connect(): Promise<PostgresPoolClientLike>;
  end(): Promise<void>;
}

export interface CreateNodePostgresClientOptions {
  databaseUrl: string;
  max?: number | undefined;
  statementTimeoutMs?: number | undefined;
}

const mutableValues = (values: readonly unknown[] | undefined): unknown[] | undefined =>
  values === undefined ? undefined : [...values];

const platformResultFor = <TRow>(
  result: PostgresPoolQueryResult<TRow>,
): PostgresQueryResult<TRow> => ({
  rows: result.rows,
  rowCount: result.rowCount,
});

export class NodePostgresClient implements PostgresTransactionalQueryClient {
  readonly pool: PostgresPoolLike;

  constructor(pool: PostgresPoolLike) {
    this.pool = pool;
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    return platformResultFor(await this.pool.query<TRow>(text, mutableValues(values)));
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const transactionClient: PostgresQueryClient = {
        query: async <TRow = Record<string, unknown>>(
          text: string,
          values: readonly unknown[] = [],
        ): Promise<PostgresQueryResult<TRow>> =>
          platformResultFor(await client.query<TRow>(text, mutableValues(values))),
      };
      const result = await operation(transactionClient);
      await client.query("COMMIT");

      return result;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // Keep the original transaction failure; rollback errors are visible in database logs.
      }

      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

export const createNodePostgresClient = ({
  databaseUrl,
  max,
  statementTimeoutMs,
}: CreateNodePostgresClientOptions): NodePostgresClient => {
  const pool = new Pool({
    connectionString: databaseUrl,
    ...(max === undefined ? {} : { max }),
    ...(statementTimeoutMs === undefined ? {} : { statement_timeout: statementTimeoutMs }),
  }) as unknown as PostgresPoolLike;

  return new NodePostgresClient(pool);
};
