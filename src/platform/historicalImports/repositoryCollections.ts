import type { HistoricalImportBatch } from "./batchContracts.js";
import type { HistoricalSaleRecord } from "./saleContracts.js";

export const retainedHistoricalImportPreviewIds = (
  batches: readonly HistoricalImportBatch[],
  leagueId: string,
  expiresBefore: Date,
  maxRetained: number,
): ReadonlySet<string> => new Set(
  batches
    .filter(batch =>
      batch.leagueId === leagueId
      && (batch.status === "previewed" || batch.status === "blocked")
    )
    .sort((left, right) =>
      right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
    )
    .filter(batch => batch.createdAt > expiresBefore)
    .slice(0, maxRetained)
    .map(batch => batch.id),
);

export const currentHistoricalRecords = (
  batches: readonly HistoricalImportBatch[],
  records: readonly HistoricalSaleRecord[],
  batchFilter: (batch: HistoricalImportBatch) => boolean,
): HistoricalSaleRecord[] => {
  const currentBatchIds = new Set(batches.filter(batchFilter).map(batch => batch.id));
  return records
    .filter(record => currentBatchIds.has(record.batchId))
    .map(record => structuredClone(record));
};

export const currentHistoricalRecordsForSeason = (
  batches: readonly HistoricalImportBatch[],
  records: readonly HistoricalSaleRecord[],
  leagueId: string,
  seasonYear: number,
): HistoricalSaleRecord[] => currentHistoricalRecords(
  batches,
  records,
  batch => batch.leagueId === leagueId
    && batch.seasonYear === seasonYear
    && batch.status === "committed",
);

export const currentHistoricalRecordsThroughSeason = (
  batches: readonly HistoricalImportBatch[],
  records: readonly HistoricalSaleRecord[],
  leagueId: string,
  seasonYear: number,
): HistoricalSaleRecord[] => currentHistoricalRecords(
  batches,
  records,
  batch => batch.leagueId === leagueId
    && batch.seasonYear <= seasonYear
    && batch.status === "committed",
);
