import type { LiveDraftStrategyKey } from "../../../../modeling/liveDraftStrategies.js";
import { buildSeasonPlayerValues, snapshotPlayerValues } from "../../../seasonPlayerValues.js";
import { createSeasonMockConfigurationSnapshot } from "../../../seasonMockSnapshot.js";
import type { SeasonMockConfigurationSnapshotV2 } from "../../../seasonMockSnapshot.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import type { SeasonMockDraftContext } from "./context.js";

export const seasonMockConfigurationSnapshotFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
  strategyKey: LiveDraftStrategyKey,
): Promise<SeasonMockConfigurationSnapshotV2> => {
  const snapshots = context.season.settings.draftFormat === "auction"
    ? await app.listLeaguePricingSnapshots({
        actorSessionToken: request.sessionToken,
        leagueId: context.season.leagueId,
        seasonYear: context.season.seasonYear,
        scenarioId: "expected",
        now: request.now,
      }) : [];
  const snapshotValues = snapshotPlayerValues(snapshots.at(-1)?.rows);
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
