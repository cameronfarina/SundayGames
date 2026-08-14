import { describe, expect, it } from "vitest";
import {
  InMemoryPlatformStore,
} from "../src/platform/platformApp.js";
import {
  PostgresPlatformStore,
  PostgresPlatformStoreError,
  createPlatformStoreSnapshotsTableStatement,
  platformStoreSnapshotsUpdatedAtIndexStatement,
  type PostgresQueryClient,
  type PostgresQueryResult,
} from "../src/platform/postgresPlatformStore.js";

const now = new Date("2026-08-09T12:00:00.000Z");

interface StoredSnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

class FakePostgresClient implements PostgresQueryClient {
  readonly queries: { text: string; values: readonly unknown[] }[] = [];
  row: StoredSnapshotRow | undefined;

  async query<TRow = Record<string, unknown>>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<TRow>> {
    this.queries.push({ text, values });

    if (text.startsWith("CREATE TABLE") || text.startsWith("CREATE INDEX")) {
      return { rows: [] };
    }

    if (text.startsWith("SELECT revision, snapshot_json")) {
      return { rows: this.row === undefined ? [] : [this.row as TRow] };
    }

    if (text.startsWith("INSERT INTO platform_store_snapshots")) {
      const [, nextRevisionValue, , snapshotJson, , expectedRevisionValue] = values;
      const nextRevision = Number(nextRevisionValue);
      const expectedRevision = Number(expectedRevisionValue);

      if (this.row === undefined) {
        if (expectedRevision !== 0) return { rows: [], rowCount: 0 };

        this.row = {
          revision: nextRevision,
          snapshot_json: snapshotJson,
        };

        return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
      }

      if (this.row.revision !== expectedRevision) {
        return { rows: [], rowCount: 0 };
      }

      this.row = {
        revision: nextRevision,
        snapshot_json: snapshotJson,
      };

      return { rows: [{ revision: nextRevision } as TRow], rowCount: 1 };
    }

    throw new Error(`Unexpected SQL: ${text}`);
  }
}

describe("Postgres platform store", () => {
  it("initializes its schema without depending on a concrete pg client", async () => {
    const client = new FakePostgresClient();

    await PostgresPlatformStore.initializeSchema(client);

    expect(client.queries.map(query => query.text)).toEqual([
      createPlatformStoreSnapshotsTableStatement,
      platformStoreSnapshotsUpdatedAtIndexStatement,
    ]);
  });

  it("saves and reloads the platform snapshot with preserved domain dates and JSON payload strings", async () => {
    const client = new FakePostgresClient();
    const postgresStore = await PostgresPlatformStore.load(client, { now: () => now });
    const job = postgresStore.store.jobs.submit({
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "league_100001-season-2026",
      kind: "simulation",
      idempotencyKey: "job-json-date",
      inputJson: {
        nested: {
          updatedAt: "2026-08-09T12:00:00.000Z",
        },
      },
      now,
    });

    await postgresStore.save();
    const reloadedStore = await PostgresPlatformStore.load(client, { now: () => now });
    const [reloadedJob] = reloadedStore.store.jobs.jobs();

    expect(postgresStore.loadedRevision).toBe(1);
    expect(client.row?.snapshot_json).toMatchObject({ schemaVersion: 1 });
    expect(reloadedJob).toEqual(job);
    expect(reloadedJob?.inputJson).toEqual({
      nested: {
        updatedAt: "2026-08-09T12:00:00.000Z",
      },
    });
    expect(reloadedJob?.createdAt).toBeInstanceOf(Date);
    expect(reloadedStore.loadedRevision).toBe(1);
  });

  it("uses optimistic revision checks to reject stale writes", async () => {
    const client = new FakePostgresClient();
    const firstWriter = await PostgresPlatformStore.load(client, { now: () => now });
    const staleWriter = await PostgresPlatformStore.load(client, { now: () => now });

    firstWriter.store.jobs.submit({
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "league_100001-season-2026",
      kind: "simulation",
      idempotencyKey: "first",
      inputJson: null,
      now,
    });
    staleWriter.store.jobs.submit({
      userId: "user_cam",
      leagueId: "league_100001",
      seasonId: "league_100001-season-2026",
      kind: "simulation",
      idempotencyKey: "stale",
      inputJson: null,
      now,
    });

    await firstWriter.save();

    await expect(staleWriter.save()).rejects.toThrow(new PostgresPlatformStoreError(
      "snapshot_write_conflict",
      "Platform store snapshot changed since it was loaded. Reload before saving.",
    ));
  });

  it("loads an empty in-memory platform store when no snapshot row exists", async () => {
    const client = new FakePostgresClient();
    const postgresStore = await PostgresPlatformStore.load(client);

    expect(postgresStore.store.snapshot()).toEqual(new InMemoryPlatformStore().snapshot());
    expect(postgresStore.loadedRevision).toBeNull();
  });
});
