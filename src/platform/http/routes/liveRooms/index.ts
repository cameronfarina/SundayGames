import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { notFound } from "../../responses.js";
import { routeLiveRoomAdvisory } from "./advisory.js";
import { routeLiveRoomEventStream } from "./eventStream.js";
import { routeLiveRoomInSeason } from "./inSeason.js";
import { routeLiveRoomMutation } from "./mutations.js";
import { routeLiveRoomMyTeam } from "./myTeam.js";
import { routeLiveRoomEvents, routeLiveRoomExport, routeLiveRoomExportArtifact, routeLiveRoomState } from "./readActions.js";
import { routeLiveRoomResource } from "./resource.js";

export const routeLiveRooms = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, roomId = "", action = ""] = request.segments;
  if (request.segments.length <= 2) return await routeLiveRoomResource(app, request, services);
  if (request.segments.length !== 3) return notFound();
  if (action === "advisory") return await routeLiveRoomAdvisory(app, request, services, roomId);
  if (action === "my-team") return await routeLiveRoomMyTeam(app, request, services, roomId);
  if (action === "in-season") return await routeLiveRoomInSeason(app, request, services, roomId);
  if (action === "state") return await routeLiveRoomState(app, request, roomId);
  if (action === "export") return await routeLiveRoomExport(app, request, roomId);
  if (action === "export-artifacts" || action === "export-artifact") {
    return await routeLiveRoomExportArtifact(app, request, roomId);
  }
  if (action === "events") return await routeLiveRoomEvents(app, request, roomId);
  if (action === "event-stream" || action === "events-stream") {
    return await routeLiveRoomEventStream(app, request, services, roomId);
  }
  return await routeLiveRoomMutation(app, request, services, roomId, action);
};
