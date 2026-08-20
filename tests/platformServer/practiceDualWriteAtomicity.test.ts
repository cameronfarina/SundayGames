import { describe, expect, it } from "vitest";
import { LiveDraftRoomRevisionNotifier } from "../../src/platform/liveDraftRoomRealtime.js";
import { createPlatformApp } from "../../src/platform/platformApp.js";
import { createNoopPlatformJobHandlers } from "../../src/platform/platformJobHandlers.js";
import type { PlatformHttpResponse } from "../../src/platform/platformHttp.js";
import type { PostgresTransactionalQueryClient } from "../../src/platform/postgresJobQueue.js";
import {
  PostgresPlatformStore,
  PostgresPlatformStoreError,
  type PostgresQueryClient,
  type PostgresQueryResult,
} from "../../src/platform/postgresPlatformStore.js";
import type { PlatformRuntime } from "../../src/platform/platformServer/internalContracts.js";
import type { PlatformPersistence } from "../../src/platform/platformServer/persistence.js";
import { createPlatformRequestHandler } from "../../src/platform/platformServer/requestHandler.js";
import { composeRuntimeRepositories } from "../../src/platform/platformServer/repositoryComposition.js";
import { createRuntimeRequest } from "../../src/platform/platformServer/runtimeRequest.js";
import { mockRunner } from "./helpers/domainFixtures.js";

class RollbackTrackingPostgresClient implements PostgresTransactionalQueryClient {
  normalizedSessionCount = 0;
  snapshotRevision: number | null = null;
  readonly operations: string[] = [];

  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
  async query(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<PostgresQueryResult<unknown>> {
    if (text.startsWith("SELECT revision, snapshot_json")) return { rows: [] };
    if (text.startsWith("SELECT revision FROM platform_store_snapshots")) {
      this.operations.push("snapshot-row-lock");
      return {
        rows: this.snapshotRevision === null ? [] : [{ revision: this.snapshotRevision }],
      };
    }
    if (text.startsWith("INSERT INTO platform_store_snapshots")) {
      this.operations.push("snapshot-row-insert");
      const nextRevision = Number(values[1]);
      const expectedRevision = Number(values[5]);
      if ((this.snapshotRevision ?? 0) !== expectedRevision) return { rows: [] };
      this.snapshotRevision = nextRevision;
      return { rows: [{ revision: nextRevision }] };
    }
    return { rows: [] };
  }

  async transaction<T>(operation: (client: PostgresQueryClient) => Promise<T>): Promise<T> {
    const normalizedSessionCount = this.normalizedSessionCount;
    const snapshotRevision = this.snapshotRevision;
    try {
      return await operation(this);
    } catch (error) {
      this.normalizedSessionCount = normalizedSessionCount;
      this.snapshotRevision = snapshotRevision;
      throw error;
    }
  }
}

describe("practice dual-write atomicity", () => {
  it("rolls back a normalized mock-session mutation when compatibility snapshot CAS fails", async () => {
    const client = new RollbackTrackingPostgresClient();
    const postgresStore = await PostgresPlatformStore.load(client);
    const store = postgresStore.store;
    const options = { postgresClient: client, simulationRunner: mockRunner };
    const repositories = composeRuntimeRepositories(options, { store, postgresStore });
    const app = createPlatformApp({ store, simulationRunner: mockRunner });
    const conflict = new PostgresPlatformStoreError(
      "snapshot_write_conflict",
      "injected compatibility snapshot conflict",
    );
    const runtime: PlatformRuntime = {
      ...repositories,
      mockDraftPersistenceMode: "dual-write",
      app,
      platformHandler: async (): Promise<PlatformHttpResponse> => {
        await client.transaction(async () => {
          client.operations.push("normalized-session-write");
          client.normalizedSessionCount += 1;
        });
        return { status: 201, body: { mockSession: { id: "mock-session" } } };
      },
      rawJobHandlers: createNoopPlatformJobHandlers(),
      liveDraftRoomSetupProvider: async () => null,
    };
    const runtimeHolder = {
      current: () => runtime,
      replace: () => undefined,
    };
    let reloadCount = 0;
    const rawPersist = async (): Promise<void> => { throw conflict; };
    const persistence: PlatformPersistence = {
      rawPersist,
      persist: rawPersist,
      runWithSnapshotReadAccess: async operation => await operation(),
      runInSnapshotCriticalSection: async operation => await operation(),
    };
    const handler = createPlatformRequestHandler({
      options,
      runtimeHolder,
      persistence,
      runRequest: createRuntimeRequest(runtimeHolder, persistence),
      liveDraftRoomNotifier: new LiveDraftRoomRevisionNotifier(),
      reloadRuntime: async () => { reloadCount += 1; },
    });

    await expect(handler({ method: "POST", path: "/mock-sessions" })).resolves.toEqual({
      status: 409,
      body: {
        error: {
          code: "snapshot_write_conflict",
          message: "Stored draft data changed before this request could be saved. Reload and try again.",
        },
      },
    });
    expect(client.normalizedSessionCount).toBe(0);
    expect(client.snapshotRevision).toBeNull();
    expect(client.operations).toEqual([
      "snapshot-row-lock",
      "snapshot-row-insert",
      "normalized-session-write",
    ]);
    expect(reloadCount).toBe(1);
  });
});
