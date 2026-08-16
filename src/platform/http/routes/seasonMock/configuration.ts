import type { LiveDraftStrategyKey } from "../../../../modeling/liveDraftStrategies.js";
import { buildSeasonPlayerValues, snapshotPlayerValues } from "../../../seasonPlayerValues.js";
import { createSeasonMockConfigurationSnapshot } from "../../../seasonMockSnapshot.js";
import type { SeasonMockConfigurationSnapshotV2 } from "../../../seasonMockSnapshot.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import type { SeasonMockDraftContext } from "./context.js";
import { currentPricingSnapshotForSeason } from "../season/pricingOrchestration.js";

export const seasonMockConfigurationSnapshotFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
  strategyKey: LiveDraftStrategyKey,
): Promise<SeasonMockConfigurationSnapshotV2> => {
  const snapshot = context.season.settings.draftFormat === "auction"
    ? await currentPricingSnapshotForSeason(app, request, context.season, context.setup)
    : undefined;
  const snapshotValues = snapshotPlayerValues(snapshot?.rows, context.setup.playerCatalog);
  const { playerExpectedPrices, playerHumanValues } = buildSeasonPlayerValues({
    season: context.season,
    playerCatalog: context.setup.playerCatalog,
    initialRosters: context.setup.initialRosters,
    humanTeamId: context.membership.teamId,
    strategyKey,
    leaguePrices: snapshotValues.leaguePrices,
    personalValues: snapshotValues.personalValues,
  });
  return createSeasonMockConfigurationSnapshot({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    playerExpectedPrices,
    playerHumanValues,
    capturedAt: request.now,
  });
};
