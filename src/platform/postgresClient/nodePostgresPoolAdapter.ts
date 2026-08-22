import type { Pool, PoolClient, QueryResultRow } from "pg";
import type {
  PostgresNotification,
  PostgresPoolClientLike,
  PostgresPoolLike,
  PostgresPoolQueryResult,
} from "../postgresClient.js";

const mutableValues = (values: readonly unknown[] | undefined): unknown[] | undefined =>
  values === undefined ? undefined : [...values];

class NodePostgresPoolClientAdapter implements PostgresPoolClientLike {
  private connectionError: Error | undefined;
  private readonly handleConnectionError = (error: Error): void => {
    this.connectionError ??= error;
  };

  constructor(private readonly client: PoolClient) {
    this.client.on("error", this.handleConnectionError);
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresPoolQueryResult<TRow>> {
    if (this.connectionError !== undefined) throw this.connectionError;

    return await this.client.query<TRow & QueryResultRow, unknown[]>(
      text,
      mutableValues(values),
    );
  }

  onNotification(listener: (notification: PostgresNotification) => void): void {
    this.client.on("notification", listener);
  }

  removeNotificationListener(listener: (notification: PostgresNotification) => void): void {
    this.client.removeListener("notification", listener);
  }

  onError(listener: (error: Error) => void): void {
    this.client.on("error", listener);
  }

  removeErrorListener(listener: (error: Error) => void): void {
    this.client.removeListener("error", listener);
  }

  release(): void {
    this.client.removeListener("error", this.handleConnectionError);
    this.client.release(this.connectionError);
  }
}

export class NodePostgresPoolAdapter implements PostgresPoolLike {
  private readonly handlePoolError = (error: Error): void => {
    console.error(JSON.stringify({
      event: "postgres_pool_error",
      message: error.message,
    }));
  };

  constructor(private readonly pool: Pool) {
    this.pool.on("error", this.handlePoolError);
  }

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
    try {
      await this.pool.end();
    } finally {
      this.pool.removeListener("error", this.handlePoolError);
    }
  }
}
