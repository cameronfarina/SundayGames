import { canonicalPlayerIdentityKey } from "../../../data/normalizePlayerName.js";
import { normalizeLeagueSeason } from "../../leagueSeason.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../request/values.js";
import { knownError, methodNotAllowed, notFound } from "../responses.js";
import { seasonMockDraftSetupFor } from "./seasonMock/context.js";

export const routePracticeShortlist = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  const seasonId = request.method === "GET" ? stringValue(request.query.seasonId) : optionalString(request.body.seasonId) ?? "";
  const season = normalizeLeagueSeason(await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  }));
  if (request.method === "GET") {
    return {
      status: 200,
      body: { items: await app.listPracticeShortlist({ actorSessionToken: request.sessionToken, seasonId: season.id, now: request.now }) },
    };
  }
  const playerName = optionalString(request.body.playerName) ?? "";
  if (playerName.length === 0) {
    return knownError(400, "player_required", "Choose a player before changing draft targets.");
  }
  if (request.method === "DELETE") {
    const removed = await app.removePracticeShortlistItem({
      actorSessionToken: request.sessionToken,
      seasonId: season.id,
      playerName,
      now: request.now,
    });
    return { status: 200, body: { removed } };
  }
  if (request.method !== "PUT") return methodNotAllowed();
  const setup = await seasonMockDraftSetupFor(season, request, services);
  if ("status" in setup) return setup;
  const player = setup.playerCatalog.find(candidate =>
    canonicalPlayerIdentityKey(candidate.name) === canonicalPlayerIdentityKey(playerName));
  if (player === undefined) return knownError(404, "player_not_found", "That player is not in this season's catalog.");
  const maxBid = optionalNumber(request.body.maxBid);
  if (maxBid !== undefined && (!Number.isInteger(maxBid) || maxBid < 1)) {
    return knownError(400, "invalid_max_bid", "Maximum bid must be a positive whole dollar amount.");
  }
  const item = await app.savePracticeShortlistItem({
    actorSessionToken: request.sessionToken,
    seasonId: season.id,
    playerName: player.name,
    position: player.position,
    ...(maxBid === undefined ? {} : { maxBid }),
    now: request.now,
  });
  return { status: 200, body: { item } };
};
