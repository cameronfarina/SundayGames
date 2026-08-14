import { hasProvisioningAccess } from "../../auth/policy.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { initialRosterPlayersFrom, playerCatalogEntriesFrom } from "../../request/domainInputs.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { dateValue, stringValue } from "../../request/values.js";
import { methodNotAllowed, notFound } from "../../responses.js";
import { liveDraftRoomReadModelForRequest } from "./readModel.js";

export const routeLiveRoomResource = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, roomId] = request.segments;
  if (request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    if (!hasProvisioningAccess(request, services)) return notFound();
    const initialRosters = Array.isArray(request.body.initialRosters)
      ? initialRosterPlayersFrom(request.body.initialRosters) : undefined;
    const room = await app.createLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      seasonId: stringValue(request.body.seasonId),
      roomId: stringValue(request.body.roomId),
      viewerPasswordHashRef: stringValue(request.body.viewerPasswordHashRef),
      startsAt: dateValue(request.body.startsAt),
      playerCatalog: playerCatalogEntriesFrom(request.body.playerCatalog),
      initialRosters,
      now: request.now,
    });
    return { status: 201, body: { room: await liveDraftRoomReadModelForRequest(app, request, room.roomId) } };
  }
  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();
    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }
  return notFound();
};
