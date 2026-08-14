import type { LeagueSeason } from "../leagueSeason.js";
import type { HistoricalImportBatch } from "./batchContracts.js";
import type { HistoricalSaleRecord } from "./saleContracts.js";
import { historicalImportBatchBaseId, historicalImportSeasonKey } from "./ids.js";
import {
  currentHistoricalRecordsForSeason,
  currentHistoricalRecordsThroughSeason,
  retainedHistoricalImportPreviewIds,
} from "./repositoryCollections.js";
import {
  replaceHistoricalBatchesAndRecords,
  replaceHistoricalLeagueSeasons,
} from "./repositoryState.js";
import type {
  HistoricalImportRepository,
  PruneHistoricalImportPreviewsInput,
} from "./repositoryContracts.js";

export class InMemoryHistoricalImportRepository implements HistoricalImportRepository {
  readonly #leagueSeasons = new Map<string, LeagueSeason>();
  readonly #batchesById = new Map<string, HistoricalImportBatch>();
  readonly #records: HistoricalSaleRecord[] = [];

  constructor(leagueSeasons: readonly LeagueSeason[] = []) {
    this.replaceLeagueSeasons(leagueSeasons);
  }

  findLeagueSeason(leagueId: string, seasonYear: number): LeagueSeason | null {
    const season = this.#leagueSeasons.get(historicalImportSeasonKey(leagueId, seasonYear));
    return season === undefined ? null : structuredClone(season);
  }

  findBatchById(batchId: string): HistoricalImportBatch | null {
    const batch = this.#batchesById.get(batchId);
    return batch === undefined ? null : structuredClone(batch);
  }

  findBatchByFileHash(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
      && batch.seasonYear === seasonYear
      && batch.fileHash === fileHash
      && batch.status !== "superseded"
    ) ?? null;
  }

  findCommittedBatchByFileHash(
    leagueId: string,
    seasonYear: number,
    fileHash: string,
  ): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
      && batch.seasonYear === seasonYear
      && batch.fileHash === fileHash
      && batch.status === "committed"
    ) ?? null;
  }

  findCurrentCommittedBatch(leagueId: string, seasonYear: number): HistoricalImportBatch | null {
    return this.batches().find(batch =>
      batch.leagueId === leagueId
      && batch.seasonYear === seasonYear
      && batch.status === "committed"
    ) ?? null;
  }

  nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): number {
    const baseId = historicalImportBatchBaseId(leagueId, seasonYear, fileHash);
    return this.batches().filter(batch => batch.id.startsWith(`${baseId}-`)).length + 1;
  }

  prunePreviewBatches({
    leagueId,
    expiresBefore,
    maxRetained,
  }: PruneHistoricalImportPreviewsInput): void {
    const activePreviews = [...this.#batchesById.values()]
      .filter(batch =>
        batch.leagueId === leagueId
        && (batch.status === "previewed" || batch.status === "blocked")
      );
    const retainedIds = retainedHistoricalImportPreviewIds(
      activePreviews,
      leagueId,
      expiresBefore,
      maxRetained,
    );
    for (const batch of activePreviews) {
      if (!retainedIds.has(batch.id)) this.#batchesById.delete(batch.id);
    }
  }

  createBatch(batch: HistoricalImportBatch): HistoricalImportBatch {
    const storedBatch = structuredClone(batch);
    this.#batchesById.set(storedBatch.id, storedBatch);
    return structuredClone(storedBatch);
  }

  updateBatch(batch: HistoricalImportBatch): HistoricalImportBatch {
    const storedBatch = structuredClone(batch);
    this.#batchesById.set(storedBatch.id, storedBatch);
    return structuredClone(storedBatch);
  }

  addRecords(records: readonly HistoricalSaleRecord[]): void {
    this.#records.push(...records.map(record => structuredClone(record)));
  }

  records(): HistoricalSaleRecord[] {
    return this.#records.map(record => structuredClone(record));
  }

  currentRecords(leagueId: string, seasonYear: number): HistoricalSaleRecord[] {
    return currentHistoricalRecordsForSeason(
      [...this.#batchesById.values()], this.#records, leagueId, seasonYear,
    );
  }

  currentRecordsThroughSeason(leagueId: string, seasonYear: number): HistoricalSaleRecord[] {
    return currentHistoricalRecordsThroughSeason(
      [...this.#batchesById.values()], this.#records, leagueId, seasonYear,
    );
  }

  batches(): HistoricalImportBatch[] {
    return [...this.#batchesById.values()].map(batch => structuredClone(batch));
  }

  replaceLeagueSeasons(leagueSeasons: readonly LeagueSeason[]): void {
    replaceHistoricalLeagueSeasons(this.#leagueSeasons, leagueSeasons);
  }

  replaceBatchesAndRecords(
    batches: readonly HistoricalImportBatch[],
    records: readonly HistoricalSaleRecord[],
  ): void {
    replaceHistoricalBatchesAndRecords(this.#batchesById, this.#records, batches, records);
  }
}
