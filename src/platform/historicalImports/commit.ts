import type { HistoricalImportBatch } from "./batchContracts.js";
import { assertHistoricalImportTarget } from "./commitValidation.js";
import { HistoricalImportError } from "./errors.js";
import type {
  CommitHistoricalImportBatchInput,
  HistoricalImportRepository,
} from "./repositoryContracts.js";
import { runHistoricalImportTransaction } from "./transactions.js";

interface CommitInRepositoryInput {
  repository: HistoricalImportRepository;
  batchId: string;
  expectedLeagueId?: string;
  expectedLeagueSeasonId?: string;
  expectedSeasonYear?: number;
  now: Date;
}

const commitInRepository = async ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
  now,
}: CommitInRepositoryInput): Promise<HistoricalImportBatch> => {
  const batch = await repository.findBatchById(batchId);
  if (batch === null) {
    throw new HistoricalImportError(
      "batch_not_found",
      `Historical import batch ${batchId} was not found.`,
    );
  }
  assertHistoricalImportTarget(batch, {
    ...(expectedLeagueId === undefined ? {} : { expectedLeagueId }),
    ...(expectedLeagueSeasonId === undefined ? {} : { expectedLeagueSeasonId }),
    ...(expectedSeasonYear === undefined ? {} : { expectedSeasonYear }),
  });
  if (batch.status === "committed" || batch.status === "superseded") return batch;
  if (batch.status === "blocked" || batch.blockers.length > 0) {
    throw new HistoricalImportError(
      "batch_blocked",
      "Cannot commit historical import batch with blockers.",
    );
  }

  const existingBatch = batch.replacementRequested
    ? null
    : await repository.findCommittedBatchByFileHash(
        batch.leagueId,
        batch.seasonYear,
        batch.fileHash,
      );
  if (existingBatch !== null) return existingBatch;

  const currentBatch = await repository.findCurrentCommittedBatch(
    batch.leagueId,
    batch.seasonYear,
  );
  if (currentBatch !== null) {
    if (!batch.replacementRequested) {
      throw new HistoricalImportError(
        "season_import_conflict",
        "Historical import batch already exists for this league season. Request replacement to supersede it.",
      );
    }
    await repository.updateBatch({
      ...currentBatch,
      status: "superseded",
      supersededAt: now,
      supersededByBatchId: batch.id,
    });
  }

  const committedBatch = await repository.updateBatch({
    ...batch,
    status: "committed",
    committedAt: now,
  });
  const records = committedBatch.rows.flatMap(row =>
    row.record === null ? [] : [row.record]
  );
  await repository.addRecords(records);
  return committedBatch;
};

export const commitHistoricalImportBatch = ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
  now = new Date(),
}: CommitHistoricalImportBatchInput): Promise<HistoricalImportBatch> =>
  runHistoricalImportTransaction(repository, transactionalRepository =>
    commitInRepository({
      repository: transactionalRepository,
      batchId,
      ...(expectedLeagueId === undefined ? {} : { expectedLeagueId }),
      ...(expectedLeagueSeasonId === undefined ? {} : { expectedLeagueSeasonId }),
      ...(expectedSeasonYear === undefined ? {} : { expectedSeasonYear }),
      now,
    })
  );
