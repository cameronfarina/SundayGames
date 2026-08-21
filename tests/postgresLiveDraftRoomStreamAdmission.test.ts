import { describe, expect, it } from "vitest";
import type { PostgresTransactionalQueryClient } from "../src/platform/postgresJobQueue.js";
import type { PostgresQueryClient, PostgresQueryResult } from "../src/platform/postgresPlatformStore.js";
import {
  LiveDraftRoomWaitLimitError,
  LiveDraftRoomRevisionNotifier,
  openSharedLiveDraftRoomRevisionSubscription,
  PostgresLiveDraftRoomStreamAdmission,
} from "../src/platform/liveDraftRoomRealtime.js";

interface LeaseRow {
  id: string;
  accountId: string;
  roomId: string;
  expiresAt: Date;
}

const normalizeSql = (text: string): string => text.replace(/\s+/g, " ").trim();

class SharedAdmissionDatabase {
  readonly leases = new Map<string, LeaseRow>();
  #tail: Promise<void> = Promise.resolve();

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    const previous = this.#tail;
    let release = (): void => undefined;
    this.#tail = new Promise<void>(resolve => { release = resolve; });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async query<TRow>(text: string, values: readonly unknown[]): Promise<PostgresQueryResult<TRow>> {
    const sql = normalizeSql(text);
    if (sql.startsWith("SELECT pg_advisory_xact_lock")) return { rows: [] };
    if (sql === "DELETE FROM live_draft_stream_leases WHERE expires_at <= $1") {
      const [now] = values as readonly [Date];
      for (const [id, lease] of this.leases) {
        if (lease.expiresAt <= now) this.leases.delete(id);
      }
      return { rows: [] };
    }
    if (sql.startsWith("SELECT COUNT(*)::integer AS global_count")) {
      const [accountId, now] = values as readonly [string, Date];
      const active = [...this.leases.values()].filter(lease => lease.expiresAt > now);
      return { rows: [{
        global_count: active.length,
        account_count: active.filter(lease => lease.accountId === accountId).length,
      } as TRow] };
    }
    if (sql.startsWith("INSERT INTO live_draft_stream_leases")) {
      const [id, accountId, roomId, expiresAt, createdAt] = values as readonly [
        string, string, string, Date, Date,
      ];
      this.leases.set(id, { id, accountId, roomId, expiresAt });
      expect(createdAt).toBeInstanceOf(Date);
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE live_draft_stream_leases SET expires_at")) {
      const [id, expiresAt, now] = values as readonly [string, Date, Date];
      const lease = this.leases.get(id);
      if (lease === undefined || lease.expiresAt <= now) return { rows: [] };
      this.leases.set(id, { ...lease, expiresAt });
      return { rows: [{ id } as TRow] };
    }
    if (sql === "DELETE FROM live_draft_stream_leases WHERE id = $1") {
      const [id] = values as readonly [string];
      this.leases.delete(id);
      return { rows: [] };
    }
    throw new Error(`Unexpected SQL: ${text}`);
  }
}

class FakeAdmissionClient implements PostgresTransactionalQueryClient {
  constructor(private readonly database: SharedAdmissionDatabase) {}

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    return await this.database.transaction(async () => await operation(this));
  }

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    return await this.database.query<TRow>(text, values);
  }
}

describe("shared Postgres live-draft stream admission", () => {
  it("serializes two instance races at the global limit and recovers on release", async () => {
    const database = new SharedAdmissionDatabase();
    const now = new Date("2026-08-20T20:00:00.000Z");
    const first = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      { maxConcurrentWaiters: 1, maxConcurrentWaitersPerAccount: 1, now: () => now, idFactory: () => "lease-first" },
    );
    const second = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      { maxConcurrentWaiters: 1, maxConcurrentWaitersPerAccount: 1, now: () => now, idFactory: () => "lease-second" },
    );

    const [firstResult, secondResult] = await Promise.allSettled([
      first.acquire({ accountId: "account_cam", roomId: "room_sunday" }),
      second.acquire({ accountId: "account_seth", roomId: "room_sunday" }),
    ]);

    expect(firstResult.status).toBe("fulfilled");
    expect(secondResult).toEqual({
      status: "rejected",
      reason: new LiveDraftRoomWaitLimitError("global", 5),
    });
    if (firstResult.status !== "fulfilled") throw firstResult.reason;
    await firstResult.value.release();
    await expect(second.acquire({ accountId: "account_seth", roomId: "room_sunday" }))
      .resolves.toBeDefined();
  });

  it("enforces the per-account limit across instances before global capacity", async () => {
    const database = new SharedAdmissionDatabase();
    const now = new Date("2026-08-20T20:00:00.000Z");
    const options = {
      maxConcurrentWaiters: 5,
      maxConcurrentWaitersPerAccount: 1,
      retryAfterSeconds: 3,
      now: () => now,
    } as const;
    const first = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      { ...options, idFactory: () => "lease-account-first" },
    );
    const second = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      { ...options, idFactory: () => "lease-account-second" },
    );

    await first.acquire({ accountId: "account_cam", roomId: "room_sunday" });
    await expect(second.acquire({ accountId: "account_cam", roomId: "room_sunday" }))
      .rejects.toEqual(new LiveDraftRoomWaitLimitError("account", 3));
  });

  it("releases the shared lease and local waiter when an aborted stream closes", async () => {
    const database = new SharedAdmissionDatabase();
    const now = new Date("2026-08-20T20:00:00.000Z");
    const admission = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      { now: () => now, idFactory: () => "lease-aborted" },
    );
    const notifier = new LiveDraftRoomRevisionNotifier({
      maxConcurrentWaiters: 1,
      maxConcurrentWaitersPerAccount: 1,
    });
    const subscription = await openSharedLiveDraftRoomRevisionSubscription({
      notifier,
      admission,
      subscription: { accountId: "account_cam", roomId: "room_sunday" },
    });
    const abort = new AbortController();
    const wait = subscription.waitForRevision({
      afterRevision: 1,
      timeoutMs: 1_000,
      signal: abort.signal,
    });

    expect(database.leases).toHaveLength(1);
    abort.abort();
    await expect(wait).resolves.toBe(false);
    await subscription.close();
    expect(database.leases).toHaveLength(0);

    const replacement = await openSharedLiveDraftRoomRevisionSubscription({
      notifier,
      admission: new PostgresLiveDraftRoomStreamAdmission(
        new FakeAdmissionClient(database),
        { now: () => now, idFactory: () => "lease-replacement" },
      ),
      subscription: { accountId: "account_cam", roomId: "room_sunday" },
    });
    await replacement.close();
  });

  it("does not revive a lease after its recovery deadline has expired", async () => {
    const database = new SharedAdmissionDatabase();
    let now = new Date("2026-08-20T20:00:00.000Z");
    const admission = new PostgresLiveDraftRoomStreamAdmission(
      new FakeAdmissionClient(database),
      {
        now: () => now,
        idFactory: () => "lease-expired",
        leaseTtlMilliseconds: 100,
        leaseRenewalMilliseconds: 50,
      },
    );
    const permit = await admission.acquire({
      accountId: "account_cam",
      roomId: "room_sunday",
    });

    now = new Date("2026-08-20T20:00:00.101Z");

    await expect(permit.renew()).rejects.toThrow(
      "Live draft stream admission lease expired.",
    );
  });
});
