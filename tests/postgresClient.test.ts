import { describe, expect, it } from "vitest";
import { NodePostgresClient } from "../src/platform/postgresClient.js";
import { FakePool } from "./support/fakePostgresPool.js";

describe("node Postgres client adapter", () => {
  it("wraps pool queries in the platform query-client contract", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await expect(client.query("SELECT $1::text AS id", ["owner11"])).resolves.toEqual({
      rows: [],
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

      return result.rowCount;
    })).resolves.toBe(1);

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

  it("holds one dedicated connection for Postgres notifications and releases it on close", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);
    const payloads: string[] = [];

    const subscription = await client.listen(
      "sunday_games_live_draft_room_revision",
      payload => payloads.push(payload),
    );
    pool.connectedClient.emitNotification(
      "sunday_games_live_draft_room_revision",
      '{"roomId":"room_sunday","revision":2}',
    );

    expect(payloads).toEqual(['{"roomId":"room_sunday","revision":2}']);
    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      'LISTEN "sunday_games_live_draft_room_revision"',
    ]);

    await subscription.close();
    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      'LISTEN "sunday_games_live_draft_room_revision"',
      'UNLISTEN "sunday_games_live_draft_room_revision"',
    ]);
    expect(pool.connectedClient.notificationListeners).toHaveLength(0);
    expect(pool.connectedClient.released).toBe(true);
  });

  it("contains dedicated notification connection errors and relies on heartbeat recovery", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);
    const subscription = await client.listen(
      "sunday_games_live_draft_room_revision",
      () => undefined,
    );

    expect(pool.connectedClient.errorListeners).toHaveLength(1);
    expect(() => pool.connectedClient.emitError(new Error("listener connection lost")))
      .not.toThrow();

    await subscription.close();

    expect(pool.connectedClient.queries.map(query => query.text)).toEqual([
      'LISTEN "sunday_games_live_draft_room_revision"',
    ]);
    expect(pool.connectedClient.notificationListeners).toHaveLength(0);
    expect(pool.connectedClient.errorListeners).toHaveLength(0);
    expect(pool.connectedClient.released).toBe(true);
  });

  it("releases the dedicated connection when a notification channel is invalid", async () => {
    const pool = new FakePool();
    const client = new NodePostgresClient(pool);

    await expect(client.listen("invalid-channel", () => undefined)).rejects.toThrow(
      "Postgres notification channel must be a lowercase SQL identifier.",
    );
    expect(pool.connectedClient.queries).toEqual([]);
    expect(pool.connectedClient.released).toBe(true);
  });
});
