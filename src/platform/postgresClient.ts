import { AsyncLocalStorage } from "node:async_hooks";
import { Pool } from "pg";
import type {
  PostgresQueryClient,
  PostgresQueryResult,
} from "./postgresPlatformStore.js";
import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import { NodePostgresPoolAdapter } from "./postgresClient/nodePostgresPoolAdapter.js";
import {
  openPostgresNotificationSubscription,
  type PostgresNotificationConnection,
  type PostgresNotificationSubscription,
} from "./postgresClient/notificationSubscription.js";

export type {
  PostgresNotification,
  PostgresNotificationClient,
  PostgresNotificationSubscription,
} from "./postgresClient/notificationSubscription.js";

export interface PostgresPoolQueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  rowCount: number | null;
}

export interface PostgresPoolClientLike extends PostgresNotificationConnection {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>>;
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

const platformClientFor = (client: PostgresPoolClientLike): PostgresQueryClient => ({
  query: async <TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> =>
    platformResultFor(await client.query<TRow>(text, mutableValues(values))),
});

export class NodePostgresClient implements PostgresTransactionalQueryClient {
  readonly pool: PostgresPoolLike;
  readonly #transactionConnections = new AsyncLocalStorage<PostgresPoolClientLike>();

  constructor(pool: PostgresPoolLike) {
    this.pool = pool;
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    const transactionConnection = this.#transactionConnections.getStore();

    return platformResultFor(await (transactionConnection ?? this.pool)
      .query<TRow>(text, mutableValues(values)));
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    const activeConnection = this.#transactionConnections.getStore();
    if (activeConnection !== undefined) {
      return await operation(platformClientFor(activeConnection));
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");
      const result = await this.#transactionConnections.run(
        client,
        async () => await operation(platformClientFor(client)),
      );
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

  async listen(
    channel: string,
    onPayload: (payload: string) => void,
  ): Promise<PostgresNotificationSubscription> {
    const connection = await this.pool.connect();
    return await openPostgresNotificationSubscription(connection, channel, onPayload);
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
  const pool = new NodePostgresPoolAdapter(new Pool({
    connectionString: databaseUrl,
    ...(max === undefined ? {} : { max }),
    ...(statementTimeoutMs === undefined ? {} : { statement_timeout: statementTimeoutMs }),
  }));

  return new NodePostgresClient(pool);
};
