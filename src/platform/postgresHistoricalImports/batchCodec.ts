import type { HistoricalImportBatch } from "../historicalImports.js";
import { historicalImportBatchStatus } from "./domainValues.js";
import { issuesFromDb } from "./issueCodec.js";
import { rowPreviewsFromDb } from "./rowPreviewCodec.js";
import type { HistoricalImportBatchRow } from "./rows.js";

const dateFromDb = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);

const nullableDateFromDb = (value: Date | string | null): Date | undefined =>
  value === null ? undefined : dateFromDb(value);

export const batchFromRow = (row: HistoricalImportBatchRow): HistoricalImportBatch => {
  const committedAt = nullableDateFromDb(row.committed_at);
  const supersededAt = nullableDateFromDb(row.superseded_at);
  return {
    id: row.id,
    leagueId: row.league_id,
    leagueSeasonId: row.league_season_id,
    seasonYear: Number(row.season_year),
    fileHash: row.file_hash,
    uploadedByUserId: row.uploaded_by_user_id,
    status: historicalImportBatchStatus(row.status),
    replacementRequested: row.replacement_requested,
    createdAt: dateFromDb(row.created_at),
    ...(committedAt === undefined ? {} : { committedAt }),
    ...(supersededAt === undefined ? {} : { supersededAt }),
    ...(row.superseded_by_batch_id === null
      ? {}
      : { supersededByBatchId: row.superseded_by_batch_id }),
    blockers: issuesFromDb(row.blockers_json),
    warnings: issuesFromDb(row.warnings_json),
    rows: rowPreviewsFromDb(row.mapping_json),
  };
};
