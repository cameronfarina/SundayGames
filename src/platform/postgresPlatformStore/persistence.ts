import type { PostgresQueryClient } from "./contracts.js";
import { platformStoreSnapshotsTableName } from "./schema.js";

export interface SnapshotRow {
  revision: number;
  snapshot_json: unknown;
}

interface SaveSnapshotRow {
  revision: number;
}

export const loadSnapshotRow = async (
  client: PostgresQueryClient,
  snapshotKey: string,
): Promise<SnapshotRow | undefined> => {
  const result = await client.query<SnapshotRow>(
    `SELECT revision, snapshot_json FROM ${platformStoreSnapshotsTableName} WHERE snapshot_key = $1`,
    [snapshotKey],
  );
  return result.rows[0];
};

export const saveSnapshotRow = async (
  client: PostgresQueryClient,
  input: {
    snapshotKey: string;
    nextRevision: number;
    snapshotHash: string;
    snapshotJson: unknown;
    updatedAt: Date;
    expectedRevision: number;
  },
): Promise<SaveSnapshotRow | undefined> => {
  const result = await client.query<SaveSnapshotRow>(`
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
`.trim(), [
    input.snapshotKey,
    input.nextRevision,
    input.snapshotHash,
    input.snapshotJson,
    input.updatedAt,
    input.expectedRevision,
  ]);
  return result.rows[0];
};
