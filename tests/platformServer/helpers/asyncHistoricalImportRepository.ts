import { leagueConfig, ownerOrder } from "../../../config/league.js";
import {
  InMemoryHistoricalImportRepository,
  type HistoricalImportRepository,
} from "../../../src/platform/historicalImports.js";
import { buildCurrentMockdLeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { InsertGate } from "./postgresRows.js";

export class AsyncHistoricalImportRepository implements HistoricalImportRepository {
  readonly inner: InMemoryHistoricalImportRepository;
  transactionCount = 0;

  constructor(leagueSeasons = [buildCurrentMockdLeagueSeason(ownerOrder, leagueConfig, {
    leagueName: "League 100001",
    setupStatus: "published",
  })], readonly createBatchGate?: InsertGate) {
    this.inner = new InMemoryHistoricalImportRepository(leagueSeasons);
  }

  async withTransaction<T>(operation: (repository: HistoricalImportRepository) => T | Promise<T>): Promise<T> {
    this.transactionCount += 1;

    return await operation(this);
  }

  async findLeagueSeason(leagueId: string, seasonYear: number) {
    return this.inner.findLeagueSeason(leagueId, seasonYear);
  }

  async findBatchById(batchId: string) {
    return this.inner.findBatchById(batchId);
  }

  async findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.findBatchByFileHash(leagueId, seasonYear, fileHash);
  }

  async findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.findCommittedBatchByFileHash(leagueId, seasonYear, fileHash);
  }

  async findCurrentCommittedBatch(leagueId: string, seasonYear: number) {
    return this.inner.findCurrentCommittedBatch(leagueId, seasonYear);
  }

  async nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string) {
    return this.inner.nextBatchOrdinal(leagueId, seasonYear, fileHash);
  }

  async prunePreviewBatches(input: Parameters<HistoricalImportRepository["prunePreviewBatches"]>[0]) {
    this.inner.prunePreviewBatches(input);
  }

  async createBatch(batch: Parameters<HistoricalImportRepository["createBatch"]>[0]) {
    this.createBatchGate?.entered();
    await this.createBatchGate?.release;
    return this.inner.createBatch(batch);
  }

  async updateBatch(batch: Parameters<HistoricalImportRepository["updateBatch"]>[0]) {
    return this.inner.updateBatch(batch);
  }

  async addRecords(records: Parameters<HistoricalImportRepository["addRecords"]>[0]) {
    this.inner.addRecords(records);
  }

  async currentRecords(leagueId: string, seasonYear: number) {
    return this.inner.currentRecords(leagueId, seasonYear);
  }

  async currentRecordsThroughSeason(leagueId: string, seasonYear: number) {
    return this.inner.currentRecordsThroughSeason(leagueId, seasonYear);
  }
}
