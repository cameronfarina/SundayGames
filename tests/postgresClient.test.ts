import { describe, expect, it } from "vitest";
import {
  createNodePostgresClient,
  NodePostgresClient,
  type PostgresPoolClientLike,
  type PostgresPoolLike,
} from "../src/platform/postgresClient.js";

class FakeConnectedClient implements PostgresPoolClientLike {
  readonly queries: { text: string; values: readonly unknown[] }[] = [];
  released = false;
  failNextQuery: Error | undefined;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number }> {
    this.queries.push({ text, values });
    if (this.failNextQuery !== undefined) {
      const error = this.failNextQuery;
      this.failNextQuery = undefined;
      throw error;
    }

    return { rows: [{ text } as TRow], rowCount: 1 };
  }

  release(): void {
    this.released = true;
  }
}

class FakePool implements PostgresPoolLike {
  readonly connectedClient = new FakeConnectedClient();
  readonly queries: { text: string; values: readonly unknown[] }[] = [];
  ended = false;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<{ rows: TRow[]; rowCount: number }> {
    this.queries.push({ text, values });

    return { rows: [{ id: "row_1" } as TRow], rowCount: 1 };
  }

  async connect(): Promise<PostgresPoolClientLike> {
    return this.connectedClient;
  }

  async end(): Promise<void> {
    this.ended = true;
  }
}

describe("node Postgres client adapter", () => {
  it("wraps pool queries in the platform query-client contract", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await expect(client.query("SELECT $1::text AS id", ["owner11"])).resolves.toEqual({
      rows: [{ id: "row_1" }],
      rowCount: 1,
    });
    expect(pool.queries).toEqual([
      { text: "SELECT $1::text AS id", values: ["owner11"] },
    ]);

    await client.close();
    expect(pool.ended).toBe(true);
  });

  it("runs transactions on one connected client and releases it on commit or rollback", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await expect(client.transaction(async transactionClient => {
      const result = await transactionClient.query("SELECT 1");

      return result.rows[0];
    })).resolves.toEqual({ text: "SELECT 1" });

    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      "BEGIN",
      "SELECT 1",
      "COMMIT",
    ]);
    expect(pool.connectedClient.released).toBe(true);
  });

  it("rolls back transactions when the operation fails", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await expect(client.transaction(async transactionClient => {
      await transactionClient.query("SELECT 1");
      throw new Error("worker failed");
    })).rejects.toThrow("worker failed");

    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      "BEGIN",
      "SELECT 1",
      "ROLLBACK",
    ]);
    expect(pool.connectedClient.released).toBe(true);
  });

  it("keeps base-client and nested transaction queries on the active connection", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await client.transaction(async transactionClient => {
      await client.query("UPDATE draft_room_setups");
      await client.transaction(async () => {
        await client.query("UPDATE draft_rooms");
      });
      await transactionClient.query("UPDATE platform_store_snapshots");
    });

    expect(pool.queries).toEqual([]);
    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      "BEGIN",
      "UPDATE draft_room_setups",
      "UPDATE draft_rooms",
      "UPDATE platform_store_snapshots",
      "COMMIT",
    ]);
  });

  it("creates a real pg pool from runtime connection settings", () => {
    const client = createNodePostgresClient({
      databaseUrl: "postgres://mockd:test@localhost:5432/mockd",
      max: 4,
      statementTimeoutMs: 2_000,
    });

    expect(client.pool.options).toMatchObject({
      connectionString: "postgres://mockd:test@localhost:5432/mockd",
      max: 4,
      statement_timeout: 2_000,
    });
  });
});
