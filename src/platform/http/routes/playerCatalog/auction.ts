import { canonicalPlayerIdentityKey } from "../../../../data/normalizePlayerName.js";
import {
  liveDraftStrategies,
  parseLiveDraftStrategyKey,
} from "../../../../modeling/liveDraftStrategies.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../../../liveDraftRooms.js";
import { buildSeasonPlayerValues } from "../../../seasonPlayerValues.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import type { BaselineMetadata, BaselinePlayer } from "./baseline.js";

export const auctionCatalogResponse = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  accountId: string,
  players: readonly BaselinePlayer[],
  keepers: readonly LiveDraftRoomInitialRosterPlayer[],
  keeperByPlayer: ReadonlyMap<string, LiveDraftRoomInitialRosterPlayer>,
  baselineMetadata: BaselineMetadata,
): Promise<PlatformHttpResponse> => {
  const latest = await app.getLatestLeaguePricingSnapshot({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    scenarioId: "expected",
    now: request.now,
  });
  const pricingByPlayer = new Map(
    (latest?.rows ?? []).map(row => [canonicalPlayerIdentityKey(row.playerName), row]),
  );
  const strategyKey = parseLiveDraftStrategyKey(optionalString(request.query.strategy) ?? "balanced");
  const strategy = liveDraftStrategies[strategyKey];
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === accountId);
  const values = buildSeasonPlayerValues({
    season,
    playerCatalog: players,
    initialRosters: keepers,
    humanTeamId: membership?.teamId,
    strategyKey,
    marketPrices: new Map(
      [...pricingByPlayer].map(([playerKey, pricing]) => [playerKey, pricing.marketPrice]),
    ),
  });
  return {
    status: 200,
    body: {
      draftFormat: "auction",
      personalized: latest !== undefined,
      ...baselineMetadata,
      strategyKey,
      strategyLabel: strategy.label,
      ...(latest === undefined ? {} : { pricingModelRunId: latest.modelRunId }),
      players: players.map(player => {
        const playerKey = canonicalPlayerIdentityKey(player.name);
        const pricing = pricingByPlayer.get(playerKey);
        const marketPrice = values.playerExpectedPrices[playerKey] ?? player.expectedPrice;
        const myValue = values.playerHumanValues[playerKey] ?? marketPrice;
        const keeper = keeperByPlayer.get(playerKey);
        return {
          ...player,
          marketPrice,
          myValue,
          leagueValue: myValue,
          recommendedMaxBid: Math.min(myValue, pricing?.recommendedMaxBid ?? myValue),
          marketValueSource: pricing === undefined ? "league_model" : "league_history",
          isKeeper: keeper !== undefined,
          ...(keeper === undefined ? {} : { keeperTeamId: keeper.teamId, keeperPrice: keeper.price }),
          pricingWarnings: pricing?.warnings ?? [],
        };
      }),
    },
  };
};
