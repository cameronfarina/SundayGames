import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import {
  liveDraftStrategies,
  parseLiveDraftStrategyKey,
} from "../../../../modeling/liveDraftStrategies.js";
import { flexEligiblePositions } from "../../../leagueCreation/flexPositions.js";
import type { ExplicitLeagueSeason } from "../../../leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../../../liveDraftRooms.js";
import type { LiveDraftRoomSetup } from "../../../liveDraftRoomSetups.js";
import { buildSeasonPlayerValues, snapshotPlayerValues } from "../../../seasonPlayerValues.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import type { BaselineMetadata, BaselinePlayer } from "./baseline.js";
import { currentPricingSnapshotForSeason } from "../season/pricingOrchestration.js";

export const auctionCatalogResponse = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: ExplicitLeagueSeason,
  accountId: string,
  players: readonly BaselinePlayer[],
  setup: Pick<LiveDraftRoomSetup, "playerCatalog" | "initialRosters"> | null,
  publishedCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  keepers: readonly LiveDraftRoomInitialRosterPlayer[],
  keeperByPlayer: ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer>,
  baselineMetadata: BaselineMetadata,
): Promise<PlatformHttpResponse> => {
  const latest = setup === null
    ? await app.getLatestLeaguePricingSnapshot({
        actorSessionToken: request.sessionToken,
        leagueId: season.leagueId,
        seasonYear: season.seasonYear,
        scenarioId: "expected",
        now: request.now,
      })
    : await currentPricingSnapshotForSeason(app, request, season, setup);
  const pricingByPlayer = new Map(
    (latest?.rows ?? []).map(row => [canonicalPlayerIdentityKey(row.playerName), row]),
  );
  const strategyKey = parseLiveDraftStrategyKey(optionalString(request.query.strategy) ?? "balanced");
  const strategy = liveDraftStrategies[strategyKey];
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === accountId);
  const snapshotValues = snapshotPlayerValues(latest?.rows, publishedCatalog);
  const values = buildSeasonPlayerValues({
    season,
    playerCatalog: players,
    initialRosters: keepers,
    humanTeamId: membership?.teamId,
    strategyKey,
    leaguePrices: snapshotValues.leaguePrices,
    personalValues: snapshotValues.personalValues,
  });
  return {
    status: 200,
    body: {
      draftFormat: "auction",
      personalized: latest !== undefined || publishedCatalog.length > 0,
      flexPositions: flexEligiblePositions(season.settings.roster.lineup),
      ...baselineMetadata,
      strategyKey,
      strategyLabel: strategy.label,
      ...(latest === undefined ? {} : { pricingModelRunId: latest.modelRunId }),
      players: players.map(player => {
        const playerKey = canonicalPlayerIdentityKey(player.name);
        const pricing = pricingByPlayer.get(playerKey);
        const marketPrice = player.marketPrice ?? player.expectedPrice;
        const leagueValue = values.playerExpectedPrices[playerKey] ?? player.expectedPrice;
        const myValue = values.playerHumanValues[playerKey] ?? leagueValue;
        const keeper = keeperByPlayer.get(playerKey);
        return {
          ...player,
          marketPrice,
          myValue,
          leagueValue,
          recommendedMaxBid: Math.min(myValue, pricing?.recommendedMaxBid ?? myValue),
          marketValueSource: player.baselineValueSource,
          isKeeper: keeper !== undefined,
          ...(keeper === undefined ? {} : { keeperTeamId: keeper.teamId, keeperPrice: keeper.price }),
          pricingWarnings: pricing?.warnings ?? [],
        };
      }),
    },
  };
};
