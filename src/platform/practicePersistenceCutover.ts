import type { PostgresTransactionalQueryClient } from "./postgresJobQueue.js";
import { deserializePlatformStoreSnapshot } from "./platformStoreSnapshotCodec.js";
import {
  snapshotHash,
  snapshotJsonForPostgres,
} from "./postgresPlatformStore/snapshot.js";

const cutoverLockKey = "sunday-games:practice-persistence-cutover";

interface CompatibilitySnapshotRow {
  snapshot_key: string;
  revision: number;
  snapshot_json: unknown;
}

export const finalizePracticePersistenceCutover = async (
  client: PostgresTransactionalQueryClient,
): Promise<void> => {
  await client.transaction(async transactionClient => {
    await transactionClient.query(
      "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
      [cutoverLockKey],
    );
    const control = await transactionClient.query<{ mode: string }>(
      `UPDATE platform_practice_persistence_control
       SET mode = 'normalized-only', updated_at = now()
       WHERE singleton = true
       RETURNING mode`,
    );
    if (control.rows.length !== 1 || control.rows[0]?.mode !== "normalized-only") {
      throw new Error("Practice-persistence cutover control row is missing.");
    }
    const snapshots = await transactionClient.query<CompatibilitySnapshotRow>(
      `SELECT snapshot_key, revision, snapshot_json
       FROM platform_store_snapshots
       WHERE COALESCE(snapshot_json->'mockDraftSessions', '[]'::jsonb) <> '[]'::jsonb
       FOR UPDATE`,
    );
    for (const row of snapshots.rows) {
      const snapshot = deserializePlatformStoreSnapshot(row.snapshot_json);
      const scrubbed = { ...snapshot, mockDraftSessions: [] };
      await transactionClient.query(
        `UPDATE platform_store_snapshots
         SET snapshot_json = $1::jsonb,
             snapshot_hash = $2,
             revision = revision + 1,
             updated_at = now()
         WHERE snapshot_key = $3 AND revision = $4`,
        [
          snapshotJsonForPostgres(scrubbed),
          snapshotHash(scrubbed),
          row.snapshot_key,
          row.revision,
        ],
      );
    }
  });
};
