import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { notFound } from "../../responses.js";
import { routeLeagueConnectionCollection } from "./collection.js";
import { routeLeagueConnectionDiscovery } from "./discover.js";
import { routeLeagueConnectionResource, routeLeagueConnectionSync } from "./resource.js";

export const routeLeagueConnections = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, connectionId = "", action = ""] = request.segments;
  if (request.segments.length === 1) {
    return await routeLeagueConnectionCollection(app, request, services);
  }
  if (request.segments.length === 2 && connectionId === "discover") {
    return await routeLeagueConnectionDiscovery(app, request, services);
  }
  if (request.segments.length === 2) {
    return await routeLeagueConnectionResource(app, request, services, connectionId);
  }
  if (request.segments.length === 3 && action === "sync") {
    return await routeLeagueConnectionSync(app, request, services, connectionId);
  }
  return notFound();
};
