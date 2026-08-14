import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  PostgresPoolClientLike,
  PostgresPoolLike,
  PostgresPoolQueryResult,
} from "../postgresClient.js";

const mutableValues = (values: readonly unknown[] | undefined): unknown[] | undefined =>
  values === undefined ? undefined : [...values];

class NodePostgresPoolClientAdapter implements PostgresPoolClientLike {
  constructor(private readonly client: PoolClient) {}

  async query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>> {
    return await this.client.query<TRow & QueryResultRow, unknown[]>(
      text,
      mutableValues(values),
    );
  }

  release(): void {
    this.client.release();
  }
}

export class NodePostgresPoolAdapter implements PostgresPoolLike {
  constructor(private readonly pool: Pool) {}

  get options(): unknown {
    return this.pool.options;
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>> {
    return await this.pool.query<TRow & QueryResultRow, unknown[]>(
      text,
      mutableValues(values),
    );
  }

  async connect(): Promise<PostgresPoolClientLike> {
    return new NodePostgresPoolClientAdapter(await this.pool.connect());
  }

  async end(): Promise<void> {
    await this.pool.end();
  }
}
