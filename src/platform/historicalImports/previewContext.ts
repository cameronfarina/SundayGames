import type { LeagueSeason } from "../leagueSeason.js";
import type { HistoricalImportBatch } from "./batchContracts.js";
import { historicalImportBatchBaseId } from "./ids.js";
import {
  defaultHistoricalImportMaxActivePreviewBatches,
  defaultHistoricalImportPreviewTtlMs,
  previewRetentionValue,
} from "./previewRetention.js";
import type { PreviewHistoricalImportBatchInput } from "./repositoryContracts.js";

export type HistoricalImportPreviewContext =
  | { status: "reusable"; batch: HistoricalImportBatch }
  | {
      status: "prepared";
      existingBatch: HistoricalImportBatch | null;
      season: LeagueSeason | null;
      seasonTemplateIsValid: boolean;
      batchId: string;
      batchCreatedAt: Date;
      batchUploader?: string;
    };

export const historicalImportPreviewContext = async (
  input: PreviewHistoricalImportBatchInput,
): Promise<HistoricalImportPreviewContext> => {
  const maxActivePreviewBatches = previewRetentionValue(
    input.maxActivePreviewBatches,
    defaultHistoricalImportMaxActivePreviewBatches,
    "maxActivePreviewBatches",
  );
  const previewTtlMs = previewRetentionValue(
    input.previewTtlMs,
    defaultHistoricalImportPreviewTtlMs,
    "previewTtlMs",
  );
  const now = input.now ?? new Date();
  const expiresBefore = new Date(now.getTime() - previewTtlMs);
  await input.repository.prunePreviewBatches({
    leagueId: input.leagueId,
    expiresBefore,
    maxRetained: maxActivePreviewBatches,
  });
  const existingBatch = input.replacementRequested === true
    ? null
    : await input.repository.findBatchByFileHash(
        input.leagueId,
        input.seasonYear,
        input.fileHash,
      );
  if (existingBatch !== null && existingBatch.status !== "blocked") {
    return { status: "reusable", batch: existingBatch };
  }
  await input.repository.prunePreviewBatches({
    leagueId: input.leagueId,
    expiresBefore,
    maxRetained: maxActivePreviewBatches - 1,
  });

  const exactSeason = input.seasonContext === undefined
    ? await input.repository.findLeagueSeason(input.leagueId, input.seasonYear)
    : null;
  const season = input.seasonContext?.currentLeagueSeason ?? exactSeason;
  const seasonTemplateIsValid = season !== null
    && season.leagueId === input.leagueId
    && season.seasonYear >= input.seasonYear;
  const baseId = historicalImportBatchBaseId(input.leagueId, input.seasonYear, input.fileHash);
  const batchId = existingBatch?.id ?? [
    baseId,
    String(await input.repository.nextBatchOrdinal(
      input.leagueId,
      input.seasonYear,
      input.fileHash,
    )).padStart(3, "0"),
  ].join("-");
  const batchUploader = input.uploadedByUserId ?? existingBatch?.uploadedByUserId;

  return {
    status: "prepared",
    existingBatch,
    season,
    seasonTemplateIsValid,
    batchId,
    batchCreatedAt: existingBatch?.createdAt ?? now,
    ...(batchUploader === undefined ? {} : { batchUploader }),
  };
};
