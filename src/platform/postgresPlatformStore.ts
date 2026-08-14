import { createHash } from "node:crypto";
import {
  deserializePlatformStoreSnapshot,
  emptyPlatformStoreSnapshot,
  serializePlatformStoreSnapshot,
} from "./platformStoreSnapshotCodec.js";
import {
  InMemoryPlatformStore,
  type InMemoryPlatformStoreSnapshot,
} from "./platformApp.js";

export interface PostgresQueryResult<TRow = Record<string, unknown>> {
  rows: TRow[];
  rowCount?: number | null | undefined;
}

export interface PostgresQueryClient {
  query<TRow = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<PostgresQueryResult<TRow>>;
}

export type PostgresPlatformStoreErrorCode = "snapshot_write_conflict";

export class PostgresPlatformStoreError extends Error {
  readonly code: PostgresPlatformStoreErrorCode;

  constructor(code: PostgresPlatformStoreErrorCode, message: string) {
    super(message);
    this.name = "PostgresPlatformStoreError";
    this.code = code;
  }
}

interface SnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

interface SaveSnapshotRow {
  revision: number;
}

export interface PostgresPlatformStoreOptions {
  snapshotKey?: string | undefined;
  now?: (() => Date) | undefined;
}

export const platformStoreSnapshotsTableName = "platform_store_snapshots";

export const createPlatformStoreSnapshotsTableStatement = `
CREATE TABLE IF NOT EXISTS ${platformStoreSnapshotsTableName} (
  snapshot_key text PRIMARY KEY,
  schema_version integer NOT NULL,
  revision integer NOT NULL,
  snapshot_hash text NOT NULL,
  snapshot_json jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ${platformStoreSnapshotsTableName}_schema_version_check CHECK (schema_version = 1),
  CONSTRAINT ${platformStoreSnapshotsTableName}_revision_check CHECK (revision > 0)
);
`.trim();

export const platformStoreSnapshotsUpdatedAtIndexStatement =
  `CREATE INDEX IF NOT EXISTS ${platformStoreSnapshotsTableName}_updated_at_idx ON ${platformStoreSnapshotsTableName} (updated_at);`;

const defaultSnapshotKey = "default";

const snapshotHash = (snapshot: InMemoryPlatformStoreSnapshot): string =>
  createHash("sha256")
    .update(JSON.stringify(serializePlatformStoreSnapshot(snapshot)))
    .digest("hex");

const snapshotJsonForPostgres = (snapshot: InMemoryPlatformStoreSnapshot): unknown => {
  const parsed: unknown = JSON.parse(JSON.stringify(serializePlatformStoreSnapshot(snapshot)));
  return parsed;
};

const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined => result.rows[0];

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
    const snapshotKey = options.snapshotKey ?? defaultSnapshotKey;
    const result = await client.query<SnapshotRow>(
      `SELECT revision, snapshot_json FROM ${platformStoreSnapshotsTableName} WHERE snapshot_key = $1`,
      [snapshotKey],
    );
    const row = firstRow(result);

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
    const nextRevision = (this.#loadedRevision ?? 0) + 1;
    const expectedRevision = this.#loadedRevision ?? 0;
    const result = await this.#client.query<SaveSnapshotRow>(
      `
INSERT INTO ${platformStoreSnapshotsTableName} (
  snapshot_key,
  schema_version,
  revision,
  snapshot_hash,
  snapshot_json,
  updated_at
) VALUES ($1, 1, $2, $3, $4::jsonb, $5)
ON CONFLICT (snapshot_key) DO UPDATE SET
  schema_version = EXCLUDED.schema_version,
  revision = EXCLUDED.revision,
  snapshot_hash = EXCLUDED.snapshot_hash,
  snapshot_json = EXCLUDED.snapshot_json,
  updated_at = EXCLUDED.updated_at
WHERE ${platformStoreSnapshotsTableName}.revision = $6
RETURNING revision;
`.trim(),
      [
        this.#snapshotKey,
        nextRevision,
        snapshotHash(snapshot),
        snapshotJsonForPostgres(snapshot),
        this.#now(),
        expectedRevision,
      ],
    );
    const row = firstRow(result);

    if (row === undefined) {
      throw new PostgresPlatformStoreError(
        "snapshot_write_conflict",
        "Platform store snapshot changed since it was loaded. Reload before saving.",
      );
    }

    this.#loadedRevision = row.revision;
  }
}
