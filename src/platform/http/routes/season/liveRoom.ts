import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { dateValue } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import { liveRoomCatalogForSeason } from "./pricingOrchestration.js";

export const routeSeasonLiveRoom = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  await requireSeasonManager(app, request, seasonId);
  const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId, now: request.now });
  if (request.method === "DELETE") {
    const roomId = `room-${season.id}-real`;
    const room = await app.getLiveDraftRoom({ actorSessionToken: request.sessionToken, roomId, now: request.now });
    if (room.seasonId !== season.id) {
      return knownError(409, "season_room_mismatch", "That draft room does not belong to this season.");
    }
    await app.cancelLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId,
      expectedRevision: room.revision,
      idempotencyKey: `cancel:${roomId}:${room.revision}`,
      now: request.now,
    });
    return { status: 200, body: { ok: true } };
  }
  if (request.method !== "POST") return methodNotAllowed();
  if (season.settings.draftFormat === "snake") {
    return knownError(
      409,
      "snake_live_room_unavailable",
      "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
    );
  }
  const startsAt = dateValue(request.body.startsAt);
  if (request.body.startsAt !== undefined && startsAt === undefined) {
    return knownError(400, "invalid_draft_time", "Choose a valid draft date and time.");
  }
  const storedSetup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  const setup = storedSetup ?? await services.liveDraftRoomSetupProvider?.(season) ?? null;
  if (setup === null) {
    return knownError(
      409,
      "live_draft_setup_missing",
      "Publish this season's player catalog and keepers before creating its live room.",
    );
  }
  const playerCatalog = await liveRoomCatalogForSeason(app, request, season, setup.playerCatalog);
  const room = await app.createLiveDraftRoom({
    actorSessionToken: request.sessionToken,
    seasonId: season.id,
    roomId: `room-${season.id}-real`,
    viewerPasswordHashRef: `account-membership:${season.id}`,
    ...(startsAt === undefined ? {} : { startsAt }),
    playerCatalog,
    initialRosters: setup.initialRosters,
    now: request.now,
  });
  return {
    status: 201,
    body: {
      room: await app.getLiveDraftRoomState({
        actorSessionToken: request.sessionToken,
        roomId: room.roomId,
        now: request.now,
      }),
    },
  };
};
