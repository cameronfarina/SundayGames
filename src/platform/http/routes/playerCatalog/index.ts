import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import { auctionCatalogResponse } from "./auction.js";
import { baselineMetadataFor, playersWithBaselineSource } from "./baseline.js";
import { keeperByPlayerFor } from "./keepers.js";
import { snakeCatalogPlayers } from "./snake.js";

export const routePlayerCatalog = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  if (services.currentPlayerCatalogProvider === undefined) {
    return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
  }
  const sourcePlayers = await services.currentPlayerCatalogProvider();
  const players = playersWithBaselineSource(sourcePlayers);
  const baselineMetadata = baselineMetadataFor(players);
  const seasonId = optionalString(request.query.seasonId);
  if (seasonId === undefined) {
    return {
      status: 200,
      body: {
        ...baselineMetadata,
        players: players.map(player => ({
          ...player,
          marketValueSource: player.baselineValueSource,
        })),
      },
    };
  }
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  const setup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  const keepers = setup?.initialRosters.filter(player => player.source === "keeper") ?? [];
  const keeperByPlayer = keeperByPlayerFor(keepers);
  if (season.settings.draftFormat === "snake") {
    return {
      status: 200,
      body: {
        draftFormat: "snake",
        personalized: false,
        ...baselineMetadata,
        players: snakeCatalogPlayers(players, keeperByPlayer),
      },
    };
  }
  return await auctionCatalogResponse(
    app,
    request,
    season,
    account.id,
    players,
    keepers,
    keeperByPlayer,
    baselineMetadata,
  );
};
