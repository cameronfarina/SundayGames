import type { LeagueSeason } from "../leagueSeason.js";
import type {
  HistoricalImportBatch,
  HistoricalImportRepository,
  HistoricalSaleRecord,
  PruneHistoricalImportPreviewsInput,
} from "../historicalImports.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import { findLeagueSeasonForLeagueYear } from "../postgresLeagueSetup/seasonReads.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import {
  findBatchByFileHash,
  findBatchById,
  findCommittedBatchByFileHash,
  findCurrentCommittedBatch,
  nextBatchOrdinal,
} from "./batchReads.js";
import { upsertBatch } from "./batchWrites.js";
import { prunePreviewBatches } from "./previewPruning.js";
import { currentRecords, currentRecordsThroughSeason } from "./saleReads.js";
import { addRecords } from "./saleWrites.js";

export class PostgresHistoricalImportRepository implements HistoricalImportRepository {
  readonly #transactionClient: PostgresTransactionalQueryClient;
  readonly #client: PostgresQueryClient;

  constructor(
    transactionClient: PostgresTransactionalQueryClient,
    client: PostgresQueryClient = transactionClient,
  ) {
    this.#transactionClient = transactionClient;
    this.#client = client;
  }

  async withTransaction<T>(
    operation: (repository: HistoricalImportRepository) => T | Promise<T>,
  ): Promise<T> {
    return await this.#transactionClient.transaction(async client =>
      await operation(new PostgresHistoricalImportRepository(this.#transactionClient, client))
    );
  }

  async findLeagueSeason(leagueId: string, seasonYear: number): Promise<LeagueSeason | null> {
    return await findLeagueSeasonForLeagueYear(this.#client, leagueId, seasonYear);
  }

  async findBatchById(batchId: string) {
    return await findBatchById(this.#client, batchId);
  }

  async findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return await findBatchByFileHash(this.#client, leagueId, seasonYear, fileHash);
  }

  async findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string) {
    return await findCommittedBatchByFileHash(this.#client, leagueId, seasonYear, fileHash);
  }

  async findCurrentCommittedBatch(leagueId: string, seasonYear: number) {
    return await findCurrentCommittedBatch(this.#client, leagueId, seasonYear);
  }

  async nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): Promise<number> {
    return await nextBatchOrdinal(this.#client, leagueId, seasonYear, fileHash);
  }

  async prunePreviewBatches(input: PruneHistoricalImportPreviewsInput): Promise<void> {
    await prunePreviewBatches(this.#client, input);
  }

  async createBatch(batch: HistoricalImportBatch): Promise<HistoricalImportBatch> {
    return await upsertBatch(this.#client, batch);
  }

  async updateBatch(batch: HistoricalImportBatch): Promise<HistoricalImportBatch> {
    return await upsertBatch(this.#client, batch);
  }

  async addRecords(records: readonly HistoricalSaleRecord[]): Promise<void> {
    await addRecords(this.#client, records);
  }

  async currentRecords(leagueId: string, seasonYear: number): Promise<HistoricalSaleRecord[]> {
    return await currentRecords(this.#client, leagueId, seasonYear);
  }

  async currentRecordsThroughSeason(
    leagueId: string,
    seasonYear: number,
  ): Promise<HistoricalSaleRecord[]> {
    return await currentRecordsThroughSeason(this.#client, leagueId, seasonYear);
  }
}
