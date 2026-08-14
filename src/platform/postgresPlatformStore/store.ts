import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
} from "../platformStoreSnapshotCodec.js";
import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "../platformApp.js";
import type { PostgresPlatformStoreOptions, PostgresQueryClient } from "./contracts.js";
import { PostgresPlatformStoreError } from "./errors.js";
import { loadSnapshotRow, saveSnapshotRow } from "./persistence.js";
import {
  createPlatformStoreSnapshotsTableStatement,
  platformStoreSnapshotsUpdatedAtIndexStatement,
} from "./schema.js";
import { defaultSnapshotKey, snapshotHash, snapshotJsonForPostgres } from "./snapshot.js";

export class PostgresPlatformStore {
  readonly store: InMemoryPlatformStore;
  readonly #client: PostgresQueryClient;
  readonly #snapshotKey: string;
  readonly #now: () => Date;
  #loadedRevision: number | null;

  private constructor(
    client: PostgresQueryClient,
    snapshot: InMemoryPlatformStoreSnapshot,
    loadedRevision: number | null,
    options: PostgresPlatformStoreOptions = {},
  ) {
    this.#client = client;
    this.#snapshotKey = options.snapshotKey ?? defaultSnapshotKey;
    this.#now = options.now ?? (() => new Date());
    this.#loadedRevision = loadedRevision;
    this.store = new InMemoryPlatformStore(snapshot);
  }

  static async initializeSchema(client: PostgresQueryClient): Promise<void> {
    await client.query(createPlatformStoreSnapshotsTableStatement);
    await client.query(platformStoreSnapshotsUpdatedAtIndexStatement);
  }

  static async load(
    client: PostgresQueryClient,
    options: PostgresPlatformStoreOptions = {},
  ): Promise<PostgresPlatformStore> {
    const row = await loadSnapshotRow(client, options.snapshotKey ?? defaultSnapshotKey);
    if (row === undefined) {
      return new PostgresPlatformStore(client, emptyPlatformStoreSnapshot(), null, options);
    }
    return new PostgresPlatformStore(
      client,
      deserializePlatformStoreSnapshot(row.snapshot_json),
      row.revision,
      options,
    );
  }

  get loadedRevision(): number | null {
    return this.#loadedRevision;
  }

  async save(): Promise<void> {
    const snapshot = this.store.snapshot();
    const expectedRevision = this.#loadedRevision ?? 0;
    const row = await saveSnapshotRow(this.#client, {
      snapshotKey: this.#snapshotKey,
      nextRevision: expectedRevision + 1,
      snapshotHash: snapshotHash(snapshot),
      snapshotJson: snapshotJsonForPostgres(snapshot),
      updatedAt: this.#now(),
      expectedRevision,
    });
    if (row === undefined) {
      throw new PostgresPlatformStoreError(
        "snapshot_write_conflict",
        "Platform store snapshot changed since it was loaded. Reload before saving.",
      );
    }
    this.#loadedRevision = row.revision;
  }
}
