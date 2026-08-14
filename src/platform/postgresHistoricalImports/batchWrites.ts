import type { HistoricalImportBatch } from "../historicalImports.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { batchFromRow } from "./batchCodec.js";
import { firstRow } from "./databaseResult.js";
import { jsonbParameter } from "./jsonValues.js";
import type { HistoricalImportBatchRow } from "./rows.js";
import { upsertBatchSql } from "./upsertBatchSql.js";

const fileNameFor = (batch: HistoricalImportBatch): string =>
  `${batch.seasonYear}-${batch.fileHash.replace(/[^a-z0-9]+/giu, "-")}.csv`;

const uploadedByUserId = (batch: HistoricalImportBatch): string => {
  if (batch.uploadedByUserId !== undefined && batch.uploadedByUserId.trim().length > 0) {
    return batch.uploadedByUserId;
  }
  throw new Error("Postgres historical import batches require uploadedByUserId.");
};

export const upsertBatch = async (
  client: PostgresQueryClient,
  batch: HistoricalImportBatch,
): Promise<HistoricalImportBatch> => {
  const result = await client.query<HistoricalImportBatchRow>(upsertBatchSql, [
    batch.id,
    batch.leagueId,
    batch.leagueSeasonId,
    batch.seasonYear,
    uploadedByUserId(batch),
    fileNameFor(batch),
    batch.fileHash,
    batch.status,
    batch.replacementRequested,
    jsonbParameter({ rows: batch.rows }),
    jsonbParameter(batch.warnings),
    jsonbParameter(batch.blockers),
    batch.committedAt ?? null,
    batch.supersededAt ?? null,
    batch.supersededByBatchId ?? null,
    batch.createdAt,
  ]);
  const row = firstRow(result);
  if (row === undefined) {
    throw new Error("Postgres historical import batch upsert did not return a row.");
  }
  return batchFromRow(row);
};
