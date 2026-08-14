import { hasProvisioningAccess } from "../../auth/policy.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { knownError, notFound } from "../../responses.js";
import { routeSeasonHistoricalImports } from "./historicalImports.js";
import { routeSeasonKeepers } from "./keepers.js";
import { routeSeasonLiveRoom } from "./liveRoom.js";
import { routeSeasonPricing } from "./pricing.js";
import { registerSeason } from "./registerSeason.js";
import { routeSeasonPublish, routeSeasonResource, routeSeasonTeamClaim } from "./resource.js";
import { routeSeasonSetupImport } from "./setupImports.js";

export const routeSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [root, seasonId = "", action] = request.segments;
  if (root !== "seasons") return notFound();
  if (request.segments.length === 1 && request.method === "POST") {
    if (!hasProvisioningAccess(request, services)) {
      return knownError(403, "provisioning_required", "League creation is restricted to deployment provisioning.");
    }
    return await registerSeason(app, request);
  }
  if (action === "setup-import") return await routeSeasonSetupImport(app, request, services);
  if (action === "historical-imports") return await routeSeasonHistoricalImports(app, request, services);
  if (action === "pricing" || action === "pricing-snapshots") return await routeSeasonPricing(app, request);
  if (action === "keepers") return await routeSeasonKeepers(app, request, services);
  if (action === "publish" && request.segments.length === 3) return await routeSeasonPublish(app, request, seasonId);
  if (action === "live-room" && request.segments.length === 3) {
    return await routeSeasonLiveRoom(app, request, services, seasonId);
  }
  if (action === "team-claims" && request.segments.length === 3) return await routeSeasonTeamClaim(app, request, seasonId);
  if (request.segments.length !== 2) return notFound();
  return await routeSeasonResource(app, request, seasonId);
};
