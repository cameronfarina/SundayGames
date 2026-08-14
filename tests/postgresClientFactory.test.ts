import { describe, expect, it, vi } from "vitest";

vi.mock("pg", () => {
  interface FakePoolOptions {
    connectionString?: string | undefined;
    ended?: boolean | undefined;
    max?: number | undefined;
    releases?: number | undefined;
    statement_timeout?: number | undefined;
  }

  class FakePoolClient {
    constructor(private readonly options: FakePoolOptions) {}

    async query(
      text: string,
    ): Promise<{ rows: { source: string }[]; rowCount: number }> {
      return {
        rows: [{ source: text }],
        rowCount: text === "SELECT transaction" ? 1 : 0,
      };
    }

    release(): void {
      this.options.releases = (this.options.releases ?? 0) + 1;
    }
  }

  class Pool {
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
      return new FakePoolClient(this.options);
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
});
