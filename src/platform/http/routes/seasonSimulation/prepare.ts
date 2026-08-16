import { randomUUID } from "node:crypto";
import { parseLiveDraftStrategyKey } from "../../../../modeling/liveDraftStrategies.js";
import type { LiveDraftStrategyKey } from "../../../../modeling/liveDraftStrategies.js";
import { loadLeagueScoredWeekOneProjections } from "../../../currentPostDraftProjectionSnapshot.js";
import { buildSeasonPlayerValues, snapshotPlayerValues } from "../../../seasonPlayerValues.js";
import type { RunSeasonSimulationsInput, SeasonSimulationTargetConstraint } from "../../../seasonSimulationEngine.js";
import { seasonSimulationTextInputFromUnknown } from "../../../simulationHttpInput.js";
import { actionRateLimitResponse } from "../../auth/rateLimits.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString, stringValue } from "../../request/values.js";
import { isSeasonMockDraftContext, seasonMockDraftContextFor } from "../seasonMock/context.js";

export interface PreparedSeasonSimulation {
  input: RunSeasonSimulationsInput;
  accountId: string;
  leagueId: string;
  seasonId: string;
  ownerId: string;
  teamId: string;
  runCount: number;
  seedPrefix: string;
  strategyInput: string;
  note?: string | undefined;
}

const presetStrategyInput: Readonly<Record<LiveDraftStrategyKey, string>> = {
  balanced: "",
  "three-rb": "prioritize 3 elite RBs",
  "hero-rb": "prioritize 1 elite RB and prioritize an elite WR",
  "wr-heavy": "prioritize 3 elite WRs",
};

export const prepareSeasonSimulation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  runCount: number,
): Promise<PreparedSeasonSimulation | PlatformHttpResponse> => {
  const textInput = seasonSimulationTextInputFromUnknown(request.body);
  const context = await seasonMockDraftContextFor(app, request, services, stringValue(request.body.seasonId));
  if (!isSeasonMockDraftContext(context)) return context;
  const limited = actionRateLimitResponse(
    request,
    services.simulationRateLimiter,
    `${context.membership.userId}:season-simulation`,
    "Too many simulation runs. Try again later.",
  );
  if (limited !== null) return limited;
  const snapshots = context.season.settings.draftFormat === "auction"
    ? await app.listLeaguePricingSnapshots({
        actorSessionToken: request.sessionToken,
        leagueId: context.season.leagueId,
        seasonYear: context.season.seasonYear,
        scenarioId: "expected",
        now: request.now,
      }) : [];
  const snapshotValues = snapshotPlayerValues(snapshots.at(-1)?.rows);
  const strategyPreset = parseLiveDraftStrategyKey(optionalString(request.body.strategyPreset) ?? "balanced");
  const { playerExpectedPrices, playerHumanValues } = buildSeasonPlayerValues({
    season: context.season,
    playerCatalog: context.setup.playerCatalog,
    initialRosters: context.setup.initialRosters,
    humanTeamId: context.membership.teamId,
    strategyKey: strategyPreset,
    leaguePrices: snapshotValues.leaguePrices,
    personalValues: snapshotValues.personalValues,
  });
  const strategyInput = [presetStrategyInput[strategyPreset], textInput.strategy].filter(Boolean).join(" and ");
  const practiceTargets = await app.listPracticeShortlist({
    actorSessionToken: request.sessionToken,
    seasonId: context.season.id,
    now: request.now,
  });
  const targetConstraints: SeasonSimulationTargetConstraint[] = practiceTargets.map(target => ({
    playerName: target.playerName,
    ...(context.season.settings.draftFormat === "auction" && target.maxBid !== undefined
      ? { maxAuctionPrice: target.maxBid } : {}),
  }));
  const seedPrefix = `season-simulation:${context.season.id}:${randomUUID()}`;
  const input: RunSeasonSimulationsInput = {
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    runCount,
    strategyInput,
    targetConstraints,
    seedPrefix,
    week1Projections: await loadLeagueScoredWeekOneProjections(context.season, context.setup.playerCatalog),
    ...(context.season.settings.draftFormat === "auction" ? { playerExpectedPrices, playerHumanValues } : {}),
  };
  return {
    input,
    accountId: context.membership.userId,
    leagueId: context.season.leagueId,
    seasonId: context.season.id,
    ownerId: context.membership.ownerId,
    teamId: context.membership.teamId,
    runCount,
    seedPrefix,
    strategyInput,
    ...(textInput.note === undefined ? {} : { note: textInput.note }),
  };
};
