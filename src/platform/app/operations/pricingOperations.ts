import {
  listLeaguePricingSnapshotsWorkflow,
  preflightLeaguePricingWorkflow,
  readLatestLeaguePricingSnapshotWorkflow,
  readLatestPricingSnapshotWorkflow,
  rebuildLeaguePricingWorkflow,
  type PreflightLeaguePricingWorkflowResult,
  type RebuildLeaguePricingWorkflowResult,
} from "../../platformPricingWorkflow.js";
import type { PricingSnapshot } from "../../pricingSnapshots.js";
import type {
  GetLatestLeaguePricingSnapshotInput,
  GetPlatformPricingSnapshotInput,
  ListPlatformPricingSnapshotsInput,
  PreflightPlatformPricingInput,
  RebuildPlatformPricingInput,
} from "../contracts/pricing.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

const requirePricingSeason = async (
  context: PlatformAppContext,
  input: RebuildPlatformPricingInput,
  mutation: boolean,
) => {
  const account = await context.requireAccount(input.actorSessionToken, input.now);
  const season = await context.requireSeasonForLeagueYear(input.leagueId, input.seasonYear);
  if (mutation) {
    await context.requireSharedMutation(account, input.leagueId);
  } else {
    await context.requireSharedRead(account, input.leagueId);
  }
  return season;
};

const pricingWorkflowInput = async (
  context: PlatformAppContext,
  input: RebuildPlatformPricingInput,
  historyBeforeFormatCheck: boolean,
) => {
  const season = await requirePricingSeason(context, input, historyBeforeFormatCheck);
  const providedRecords = input.historicalSaleRecords;
  const earlyRecords = historyBeforeFormatCheck
    ? providedRecords ?? await context.historicalImports.currentRecordsThroughSeason(input.leagueId, input.seasonYear)
    : undefined;
  if (season.settings.draftFormat === "snake") {
    throw new PlatformAppError(
      "shared_mutation_denied",
      "Auction price rebuilding is not available for snake league seasons.",
    );
  }
  const historicalSaleRecords = earlyRecords
    ?? providedRecords
    ?? await context.historicalImports.currentRecordsThroughSeason(input.leagueId, input.seasonYear);
  return {
    repository: context.store.pricingSnapshots,
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    scenarioIds: input.scenarioIds,
    baselinePrices: input.baselinePrices,
    historicalSaleRecords,
    currentAuctionBudget: season.settings.auction.budgetDollars,
    currentTeamCount: season.teams.length,
    currentRosterSize: season.settings.roster.rosterSize,
    currentMinimumBidDollars: season.settings.auction.minimumBidDollars,
    currentKeeperCount: input.currentKeeperCount ?? 0,
    keeperLockedSpend: input.keeperLockedSpend ?? 0,
    ...(input.currentKeepers === undefined ? {} : { currentKeepers: input.currentKeepers }),
    ...(input.now === undefined ? {} : { createdAt: input.now.toISOString() }),
  };
};

export const createPricingOperations = (context: PlatformAppContext) => ({
  preflightLeaguePricing: async (
    input: PreflightPlatformPricingInput,
  ): Promise<PreflightLeaguePricingWorkflowResult> =>
    cloneForRead(preflightLeaguePricingWorkflow(await pricingWorkflowInput(context, input, false))),

  rebuildLeaguePricing: async (
    input: RebuildPlatformPricingInput,
  ): Promise<RebuildLeaguePricingWorkflowResult> =>
    cloneForRead(rebuildLeaguePricingWorkflow(await pricingWorkflowInput(context, input, true))),

  listLeaguePricingSnapshots: async (
    input: ListPlatformPricingSnapshotsInput,
  ): Promise<readonly PricingSnapshot[]> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSeasonForLeagueYear(input.leagueId, Number(input.seasonYear));
    await context.requireSharedRead(account, input.leagueId);
    return listLeaguePricingSnapshotsWorkflow(context.store.pricingSnapshots, {
      leagueId: input.leagueId,
      seasonYear: input.seasonYear,
      ...(input.modelRunId === undefined ? {} : { modelRunId: input.modelRunId }),
      ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
    }).map(cloneForRead);
  },

  getLatestLeaguePricingSnapshot: async (
    input: GetLatestLeaguePricingSnapshotInput,
  ): Promise<PricingSnapshot | undefined> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    await context.requireSeasonForLeagueYear(input.leagueId, Number(input.seasonYear));
    await context.requireSharedRead(account, input.leagueId);
    const snapshot = readLatestLeaguePricingSnapshotWorkflow(context.store.pricingSnapshots, {
      leagueId: input.leagueId,
      seasonYear: input.seasonYear,
      ...(input.modelRunId === undefined ? {} : { modelRunId: input.modelRunId }),
      ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
    });
    return snapshot === undefined ? undefined : cloneForRead(snapshot);
  },

  getPricingSnapshot: async (input: GetPlatformPricingSnapshotInput): Promise<PricingSnapshot> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const snapshot = readLatestPricingSnapshotWorkflow(context.store.pricingSnapshots, {
      modelRunId: input.modelRunId,
      ...(input.scenarioId === undefined ? {} : { scenarioId: input.scenarioId }),
    });
    if (snapshot === undefined) {
      throw new PlatformAppError("pricing_snapshot_not_found", "Pricing snapshot was not found.");
    }
    await context.requireSharedRead(account, snapshot.leagueId);
    return cloneForRead(snapshot);
  },
});
