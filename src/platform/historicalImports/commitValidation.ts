import type { HistoricalImportBatch } from "./batchContracts.js";
import { HistoricalImportTargetError } from "./errors.js";
import type { CommitHistoricalImportBatchInput } from "./repositoryContracts.js";

type ExpectedTarget = Pick<
  CommitHistoricalImportBatchInput,
  "expectedLeagueId" | "expectedLeagueSeasonId" | "expectedSeasonYear"
>;

export const assertHistoricalImportTarget = (
  batch: HistoricalImportBatch,
  expected: ExpectedTarget,
): void => {
  const mismatches: string[] = [];
  if (expected.expectedLeagueId !== undefined && batch.leagueId !== expected.expectedLeagueId) {
    mismatches.push(`league ${expected.expectedLeagueId}`);
  }
  if (
    expected.expectedLeagueSeasonId !== undefined
    && batch.leagueSeasonId !== expected.expectedLeagueSeasonId
  ) {
    mismatches.push(`league season ${expected.expectedLeagueSeasonId}`);
  }
  if (
    expected.expectedSeasonYear !== undefined
    && batch.seasonYear !== expected.expectedSeasonYear
  ) {
    mismatches.push(`historical season ${expected.expectedSeasonYear}`);
  }
  if (mismatches.length > 0) {
    throw new HistoricalImportTargetError(
      `Historical import batch ${batch.id} does not belong to the requested ${mismatches.join(" or ")}.`,
    );
  }
};
