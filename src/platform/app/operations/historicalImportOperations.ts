import { prepareHistoricalImportBatchCommit, type HistoricalSaleRecord } from "../../historicalImports.js";
import {
  commitHistoricalImportWorkflow,
  previewHistoricalImportSourceWorkflow,
  type CommitHistoricalImportWorkflowResult,
  type PreviewHistoricalImportSourceWorkflowResult,
} from "../../platformHistoricalImportWorkflow.js";
import type {
  CommitPlatformHistoricalImportInput,
  ListPlatformHistoricalImportYearsInput,
  PreparePlatformHistoricalImportCommitInput,
  PreparePlatformHistoricalImportCommitResult,
  PreviewPlatformHistoricalImportInput,
} from "../contracts/historicalImport.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

export const createHistoricalImportOperations = (context: PlatformAppContext) => ({
  listHistoricalImportSeasonYears: async (
    input: ListPlatformHistoricalImportYearsInput,
  ): Promise<number[]> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSharedRead(account, input.leagueId);
    const records = await context.historicalImports.currentRecordsThroughSeason(
      input.leagueId,
      input.seasonYear,
    );
    return [...new Set(records.map(record => record.seasonYear))].sort((left, right) => right - left);
  },

  listHistoricalSaleRecords: async (
    input: ListPlatformHistoricalImportYearsInput,
  ): Promise<readonly HistoricalSaleRecord[]> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSharedRead(account, input.leagueId);
    return cloneForRead(await context.historicalImports.currentRecordsThroughSeason(
      input.leagueId,
      input.seasonYear,
    ));
  },

  previewHistoricalImportSource: async (
    input: PreviewPlatformHistoricalImportInput,
  ): Promise<PreviewHistoricalImportSourceWorkflowResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const currentSeason = input.currentSeasonId === undefined
      ? await context.requireSeasonForLeagueYear(input.leagueId, input.seasonYear)
      : await context.requireSeason(input.currentSeasonId);
    if (currentSeason.leagueId !== input.leagueId) {
      throw new PlatformAppError("season_not_found", "League season was not found.");
    }
    await context.requireSharedMutation(account, input.leagueId);
    return cloneForRead(await previewHistoricalImportSourceWorkflow({
      repository: context.historicalImports,
      leagueId: input.leagueId,
      seasonYear: input.seasonYear,
      ...(input.currentSeasonId === undefined ? {} : { seasonContext: { currentLeagueSeason: currentSeason } }),
      sourceText: input.sourceText,
      ...(input.inferFirstRosterRowAsKeeper === undefined
        ? {}
        : { inferFirstRosterRowAsKeeper: input.inferFirstRosterRowAsKeeper }),
      uploadedByUserId: account.id,
      ...(input.replacementRequested === undefined ? {} : { replacementRequested: input.replacementRequested }),
      ...(input.playerCatalog === undefined ? {} : { playerCatalog: input.playerCatalog }),
      ...(input.ownerMappings === undefined ? {} : { ownerMappings: input.ownerMappings }),
      ...(input.requireCompleteTeamMapping === undefined
        ? {}
        : { requireCompleteTeamMapping: input.requireCompleteTeamMapping }),
      ...(input.playerMappings === undefined ? {} : { playerMappings: input.playerMappings }),
      ...(input.now === undefined ? {} : { now: input.now }),
    }));
  },

  commitHistoricalImport: async (
    input: CommitPlatformHistoricalImportInput,
  ): Promise<CommitHistoricalImportWorkflowResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const batch = await context.historicalImports.findBatchById(input.batchId);
    if (batch === null) {
      throw new PlatformAppError("historical_import_not_found", "Historical import batch was not found.");
    }
    await context.requireSharedMutation(account, batch.leagueId);
    return cloneForRead(await commitHistoricalImportWorkflow({
      repository: context.historicalImports,
      batchId: input.batchId,
      ...(input.expectedLeagueId === undefined ? {} : { expectedLeagueId: input.expectedLeagueId }),
      ...(input.expectedLeagueSeasonId === undefined
        ? {}
        : { expectedLeagueSeasonId: input.expectedLeagueSeasonId }),
      ...(input.expectedSeasonYear === undefined ? {} : { expectedSeasonYear: input.expectedSeasonYear }),
      ...(input.now === undefined ? {} : { now: input.now }),
    }));
  },

  prepareHistoricalImportCommit: async (
    input: PreparePlatformHistoricalImportCommitInput,
  ): Promise<PreparePlatformHistoricalImportCommitResult> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const prepared = await prepareHistoricalImportBatchCommit({
      repository: context.historicalImports,
      batchId: input.batchId,
      ...(input.expectedLeagueId === undefined ? {} : { expectedLeagueId: input.expectedLeagueId }),
      ...(input.expectedLeagueSeasonId === undefined
        ? {}
        : { expectedLeagueSeasonId: input.expectedLeagueSeasonId }),
      ...(input.expectedSeasonYear === undefined ? {} : { expectedSeasonYear: input.expectedSeasonYear }),
    });
    await context.requireSharedMutation(account, prepared.batch.leagueId);
    const records = await context.historicalImports.currentRecordsThroughSeason(
      prepared.batch.leagueId,
      input.pricingSeasonYear,
    );
    return cloneForRead({
      batch: prepared.batch,
      projectedHistoricalSaleRecords: [
        ...records.filter(record => record.seasonYear !== prepared.batch.seasonYear),
        ...prepared.committedRecords,
      ],
    });
  },
});
