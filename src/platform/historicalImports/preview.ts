import type { HistoricalImportBatch } from "./batchContracts.js";
import {
  missingSeasonBatch,
  teamCountMismatchBatch,
  type BlockedBatchIdentity,
} from "./blockedBatch.js";
import {
  analyzedRowPreviews,
  distinctHistoricalTeamsFor,
  ownerMappingBlockers,
  spendWarnings,
} from "./previewAnalysis.js";
import { historicalImportPreviewContext } from "./previewContext.js";
import type { PreviewHistoricalImportBatchInput } from "./repositoryContracts.js";

const previewInRepository = async (
  input: PreviewHistoricalImportBatchInput,
): Promise<HistoricalImportBatch> => {
  const context = await historicalImportPreviewContext(input);
  if (context.status === "reusable") return context.batch;

  const replacementRequested = input.replacementRequested ?? false;
  const ownerMappings = input.ownerMappings ?? [];
  const requireCompleteTeamMapping = input.requireCompleteTeamMapping ?? false;
  const persistBatch = async (batch: HistoricalImportBatch): Promise<HistoricalImportBatch> =>
    context.existingBatch === null
      ? await input.repository.createBatch(batch)
      : await input.repository.updateBatch(batch);
  const identity: BlockedBatchIdentity = {
    id: context.batchId,
    leagueId: input.leagueId,
    leagueSeasonId: context.season?.id ?? null,
    seasonYear: input.seasonYear,
    fileHash: input.fileHash,
    ...(context.batchUploader === undefined
      ? {}
      : { uploadedByUserId: context.batchUploader }),
    replacementRequested,
    createdAt: context.batchCreatedAt,
  };

  if (!context.seasonTemplateIsValid || context.season === null) {
    const message = input.seasonContext === undefined
      ? `No season ${input.seasonYear} is configured for league ${input.leagueId}.`
      : `Current season context must belong to league ${input.leagueId} and cannot predate historical season ${input.seasonYear}.`;
    return await persistBatch(missingSeasonBatch(identity, input.rows, message));
  }

  const season = context.season;
  const distinctHistoricalTeams = distinctHistoricalTeamsFor(input.rows);
  if (requireCompleteTeamMapping && distinctHistoricalTeams.size !== season.teams.length) {
    return await persistBatch(teamCountMismatchBatch(
      identity,
      input.rows,
      distinctHistoricalTeams.size,
      season.teams.length,
    ));
  }

  const rows = analyzedRowPreviews({
    rows: input.rows,
    batchId: context.batchId,
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    season,
    ownerMappings,
  });
  const mappingBlockers = ownerMappingBlockers(
    rows,
    distinctHistoricalTeams.size,
    requireCompleteTeamMapping,
  );
  const blockers = [
    ...mappingBlockers,
    ...rows.flatMap(row => row.blockers),
  ];
  return await persistBatch({
    ...identity,
    leagueSeasonId: season.id,
    status: blockers.length > 0 ? "blocked" : "previewed",
    blockers,
    warnings: spendWarnings(rows, season),
    rows,
  });
};

export const previewHistoricalImportBatch = async (
  input: PreviewHistoricalImportBatchInput,
): Promise<HistoricalImportBatch> => {
  if (input.repository.withTransaction === undefined) {
    return await previewInRepository(input);
  }
  return await input.repository.withTransaction(repository =>
    previewInRepository({ ...input, repository })
  );
};
