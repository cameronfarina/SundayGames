import type { PruneHistoricalImportPreviewsInput } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";

export const prunePreviewBatches = async (
  client: PostgresQueryClient,
  { leagueId, expiresBefore, maxRetained }: PruneHistoricalImportPreviewsInput,
): Promise<void> => {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    `historical-import-previews:${leagueId}`,
  ]);
  await client.query(
    `DELETE FROM historical_import_batches
WHERE league_id = $1
  AND status IN ('previewed', 'blocked')
  AND created_at <= $2`,
    [leagueId, expiresBefore],
  );
  await client.query(
    `DELETE FROM historical_import_batches
WHERE id IN (
  SELECT id
  FROM historical_import_batches
  WHERE league_id = $1
    AND status IN ('previewed', 'blocked')
  ORDER BY created_at DESC, id DESC
  OFFSET $2
)`,
    [leagueId, maxRetained],
  );
};
