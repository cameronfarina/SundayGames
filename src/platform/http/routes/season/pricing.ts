import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import { pricingSourcePricesFrom } from "../../request/domainInputs.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString, stringArrayValue, stringValue } from "../../request/values.js";
import { methodNotAllowed, notFound } from "../../responses.js";

export const routeSeasonPricing = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, seasonAction, action] = request.segments;
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    now: request.now,
  });
  if (seasonAction === "pricing" && action === "rebuild" && request.segments.length === 4) {
    if (request.method !== "POST") return methodNotAllowed();
    const result = await app.rebuildLeaguePricing({
      actorSessionToken: request.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: stringValue(request.body.modelVersion),
      scenarioIds: stringArrayValue(request.body.scenarioIds),
      baselinePrices: pricingSourcePricesFrom(request.body.baselinePrices),
      now: request.now,
    });
    return { status: 201, body: result };
  }
  if (seasonAction === "pricing-snapshots" && request.segments.length === 3) {
    if (request.method !== "GET") return methodNotAllowed();
    const pricingSnapshots = await app.listLeaguePricingSnapshots({
      actorSessionToken: request.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelRunId: optionalString(request.query.modelRunId),
      scenarioId: optionalString(request.query.scenarioId),
      now: request.now,
    });
    return { status: 200, body: { pricingSnapshots } };
  }
  return notFound();
};
