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
