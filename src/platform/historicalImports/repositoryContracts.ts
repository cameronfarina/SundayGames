import type { LeagueSeason } from "../leagueSeason.js";
import type {
  HistoricalImportBatch,
  HistoricalImportSeasonContext,
  HistoricalOwnerMapping,
} from "./batchContracts.js";
import type { NormalizedHistoricalImportRow } from "./playerContracts.js";
import type { HistoricalSaleRecord } from "./saleContracts.js";

export type MaybePromise<T> = T | Promise<T>;

export interface PreviewHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  leagueId: string;
  seasonYear: number;
  seasonContext?: HistoricalImportSeasonContext;
  fileHash: string;
  uploadedByUserId?: string;
  replacementRequested?: boolean;
  ownerMappings?: readonly HistoricalOwnerMapping[];
  requireCompleteTeamMapping?: boolean;
  rows: readonly NormalizedHistoricalImportRow[];
  maxActivePreviewBatches?: number;
  previewTtlMs?: number;
  now?: Date;
}

export interface PruneHistoricalImportPreviewsInput {
  leagueId: string;
  expiresBefore: Date;
  maxRetained: number;
}

export interface CommitHistoricalImportBatchInput {
  repository: HistoricalImportRepository;
  batchId: string;
  expectedLeagueId?: string;
  expectedLeagueSeasonId?: string;
  expectedSeasonYear?: number;
  now?: Date;
}

export interface PreparedHistoricalImportCommit {
  batch: HistoricalImportBatch;
  committedRecords: readonly HistoricalSaleRecord[];
}

export interface HistoricalImportRepository {
  withTransaction?<T>(operation: (repository: HistoricalImportRepository) => MaybePromise<T>): MaybePromise<T>;
  findLeagueSeason(leagueId: string, seasonYear: number): MaybePromise<LeagueSeason | null>;
  findBatchById(batchId: string): MaybePromise<HistoricalImportBatch | null>;
  findBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<HistoricalImportBatch | null>;
  findCommittedBatchByFileHash(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<HistoricalImportBatch | null>;
  findCurrentCommittedBatch(leagueId: string, seasonYear: number): MaybePromise<HistoricalImportBatch | null>;
  nextBatchOrdinal(leagueId: string, seasonYear: number, fileHash: string): MaybePromise<number>;
  prunePreviewBatches(input: PruneHistoricalImportPreviewsInput): MaybePromise<void>;
  createBatch(batch: HistoricalImportBatch): MaybePromise<HistoricalImportBatch>;
  updateBatch(batch: HistoricalImportBatch): MaybePromise<HistoricalImportBatch>;
  addRecords(records: readonly HistoricalSaleRecord[]): MaybePromise<void>;
  currentRecords(leagueId: string, seasonYear: number): MaybePromise<HistoricalSaleRecord[]>;
  currentRecordsThroughSeason(leagueId: string, seasonYear: number): MaybePromise<HistoricalSaleRecord[]>;
}
