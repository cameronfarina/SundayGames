import type { LeagueSeason } from "../leagueSeason.js";
import type { HistoricalImportBatch } from "./batchContracts.js";
import { historicalImportSeasonKey } from "./ids.js";
import type { HistoricalSaleRecord } from "./saleContracts.js";

export const replaceHistoricalLeagueSeasons = (
  target: Map<string, LeagueSeason>,
  leagueSeasons: readonly LeagueSeason[],
): void => {
  target.clear();
  for (const season of leagueSeasons) {
    const storedSeason = structuredClone(season);
    target.set(
      historicalImportSeasonKey(storedSeason.leagueId, storedSeason.seasonYear),
      storedSeason,
    );
  }
};

export const replaceHistoricalBatchesAndRecords = (
  batchesById: Map<string, HistoricalImportBatch>,
  targetRecords: HistoricalSaleRecord[],
  batches: readonly HistoricalImportBatch[],
  records: readonly HistoricalSaleRecord[],
): void => {
  batchesById.clear();
  targetRecords.length = 0;
  for (const batch of batches) {
    const storedBatch = structuredClone(batch);
    batchesById.set(storedBatch.id, storedBatch);
  }
  targetRecords.push(...records.map(record => structuredClone(record)));
};
