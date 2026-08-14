import { assertHistoricalImportTarget } from "./commitValidation.js";
import { HistoricalImportError } from "./errors.js";
import type {
  CommitHistoricalImportBatchInput,
  PreparedHistoricalImportCommit,
} from "./repositoryContracts.js";

export const prepareHistoricalImportBatchCommit = async ({
  repository,
  batchId,
  expectedLeagueId,
  expectedLeagueSeasonId,
  expectedSeasonYear,
}: Omit<CommitHistoricalImportBatchInput, "now">): Promise<PreparedHistoricalImportCommit> => {
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
  if (batch.status === "blocked" || batch.blockers.length > 0) {
    throw new HistoricalImportError(
      "batch_blocked",
      "Cannot commit historical import batch with blockers.",
    );
  }

  const effectiveBatch = batch.status === "committed" || batch.status === "superseded"
    ? batch
    : await repository.findCommittedBatchByFileHash(
        batch.leagueId,
        batch.seasonYear,
        batch.fileHash,
      ) ?? batch;
  if (effectiveBatch.status !== "committed" && effectiveBatch.status !== "superseded") {
    const currentBatch = await repository.findCurrentCommittedBatch(
      batch.leagueId,
      batch.seasonYear,
    );
    if (currentBatch !== null && !batch.replacementRequested) {
      throw new HistoricalImportError(
        "season_import_conflict",
        "Historical import batch already exists for this league season. Request replacement to supersede it.",
      );
    }
  }

  return {
    batch: effectiveBatch,
    committedRecords: effectiveBatch.rows.flatMap(row =>
      row.record === null ? [] : [row.record]
    ),
  };
};
