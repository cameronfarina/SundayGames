import { describe, expect, it, vi } from "vitest";

interface FakePoolClientControl {
  emitError(error: Error): void;
  releasedWith: Error | undefined;
}

const pgMockState = vi.hoisted((): { connectedClient: FakePoolClientControl | undefined } => ({
  connectedClient: undefined,
}));

vi.mock("pg", () => {
  interface FakePoolOptions {
    connectionString?: string | undefined;
    ended?: boolean | undefined;
    max?: number | undefined;
    releases?: number | undefined;
    statement_timeout?: number | undefined;
  }

  class FakePoolClient {
    readonly errorListeners = new Set<(error: Error) => void>();
    releasedWith: Error | undefined;

    constructor(private readonly options: FakePoolOptions) {}

    on(event: "error", listener: (error: Error) => void): void {
      if (event === "error") this.errorListeners.add(listener);
    }

    removeListener(event: "error", listener: (error: Error) => void): void {
      if (event === "error") this.errorListeners.delete(listener);
    }

    emitError(error: Error): void {
      if (this.errorListeners.size === 0) throw error;
      for (const listener of this.errorListeners) listener(error);
    }

    async query(
      text: string,
    ): Promise<{ rows: { source: string }[]; rowCount: number }> {
      return {
        rows: [{ source: text }],
        rowCount: text === "SELECT transaction" ? 1 : 0,
      };
    }

    release(error?: Error): void {
      this.releasedWith = error;
      this.options.releases = (this.options.releases ?? 0) + 1;
    }
  }

  class Pool {
    readonly errorListeners = new Set<(error: Error) => void>();
    readonly options: FakePoolOptions;

    constructor(options: FakePoolOptions = {}) {
      this.options = options;
    }

    async query(
      _text: string,
      values: readonly unknown[] = [],
    ): Promise<{ rows: { value: unknown }[]; rowCount: number }> {
      return { rows: [{ value: values[0] }], rowCount: values.length };
    }

    async connect(): Promise<FakePoolClient> {
      const client = new FakePoolClient(this.options);
      pgMockState.connectedClient = client;
      return client;
    }

    on(event: "error", listener: (error: Error) => void): void {
      if (event === "error") this.errorListeners.add(listener);
    }

    removeListener(event: "error", listener: (error: Error) => void): void {
      if (event === "error") this.errorListeners.delete(listener);
    }

    async end(): Promise<void> {
      this.options.ended = true;
    }
  }

  return { Pool };
});

import { createNodePostgresClient } from "../src/platform/postgresClient.js";

describe("node-postgres pool adapter", () => {
  it("adapts pool queries, transactions, connection settings, and shutdown", async () => {
    const client = createNodePostgresClient({
      databaseUrl: "postgres://mockd:test@localhost:5432/mockd",
      max: 4,
      statementTimeoutMs: 2_000,
    });

    await expect(client.query<{ value: string }>(
      "SELECT $1::text",
      ["owner11"],
    )).resolves.toEqual({
      rows: [{ value: "owner11" }],
      rowCount: 1,
    });
    await expect(client.transaction(async transactionClient => {
      const result = await transactionClient.query<{ source: string }>("SELECT transaction");
      return result.rows[0]?.source;
    })).resolves.toBe("SELECT transaction");

    await client.close();
    expect(client.pool.options).toMatchObject({
      connectionString: "postgres://mockd:test@localhost:5432/mockd",
      ended: true,
      max: 4,
      releases: 1,
      statement_timeout: 2_000,
    });
  });

  it("contains checked-out connection errors and evicts the failed connection", async () => {
    const client = createNodePostgresClient({
      databaseUrl: "postgres://mockd:test@localhost:5432/mockd",
    });
    const connectionError = new Error("Connection terminated unexpectedly");

    await expect(client.transaction(async transactionClient => {
      expect(() => pgMockState.connectedClient?.emitError(connectionError)).not.toThrow();
      await transactionClient.query("SELECT after_disconnect");
    })).rejects.toThrow("Connection terminated unexpectedly");

    expect(pgMockState.connectedClient?.releasedWith).toBe(connectionError);
  });
});
