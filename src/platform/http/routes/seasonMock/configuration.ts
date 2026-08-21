import { managerDraftProfilesFor } from "../../../managerDraftProfiles.js";
import { buildSeasonAuctionMockConfig } from "../../../seasonAuctionMock.js";
import { buildSeasonPlayerValues, snapshotPlayerValues } from "../../../seasonPlayerValues.js";
import { createSeasonMockConfigurationSnapshot } from "../../../seasonMockSnapshot.js";
import type { SeasonMockConfigurationSnapshotV2 } from "../../../seasonMockSnapshot.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { currentPricingSnapshotForSeason } from "../season/pricingOrchestration.js";
import type { SeasonMockDraftContext } from "./context.js";

const managerProfilesFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
  playerExpectedPrices: Readonly<Record<string, number>>,
  playerHumanValues: Readonly<Record<string, number>>,
) => {
  if (context.season.settings.draftFormat !== "auction") return [];
  const historicalSaleRecords = await app.listHistoricalSaleRecords({
    actorSessionToken: request.sessionToken,
    leagueId: context.season.leagueId,
    seasonYear: context.season.seasonYear - 1,
    now: request.now,
  });
  const config = buildSeasonAuctionMockConfig({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    sessionId: "profile-snapshot",
    seed: "profile-snapshot",
    playerExpectedPrices,
    playerHumanValues,
    historicalSaleRecords,
  });
  return managerDraftProfilesFor({
    leagueId: context.season.leagueId,
    teams: context.season.teams,
    players: config.players,
    keptPlayerIds: new Set(config.keepers?.map(keeper => keeper.playerId) ?? []),
    historicalSaleRecords,
  });
};

export const seasonMockConfigurationSnapshotFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
): Promise<SeasonMockConfigurationSnapshotV2> => {
  const snapshot = context.season.settings.draftFormat === "auction"
    ? await currentPricingSnapshotForSeason(app, request, context.season, context.setup)
    : undefined;
  const snapshotValues = snapshotPlayerValues(snapshot?.rows, context.setup.playerCatalog);
  const { playerExpectedPrices, playerHumanValues } = buildSeasonPlayerValues({
    playerCatalog: context.setup.playerCatalog,
    leaguePrices: snapshotValues.leaguePrices,
    personalValues: snapshotValues.personalValues,
  });
  const managerProfiles = await managerProfilesFor(
    app,
    request,
    context,
    playerExpectedPrices,
    playerHumanValues,
  );
  return createSeasonMockConfigurationSnapshot({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    playerExpectedPrices,
    playerHumanValues,
    managerProfiles,
    capturedAt: request.now,
  });
};
