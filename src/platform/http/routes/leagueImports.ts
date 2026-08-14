import { requireRequestAccount } from "../auth/access.js";
import { actionRateLimitResponse, screenshotRateLimitResponse } from "../auth/rateLimits.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../request/values.js";
import { knownError, methodNotAllowed, notFound } from "../responses.js";

export const routeLeagueImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, provider, action] = request.segments;
  if (provider !== "espn" || request.segments.length !== 3) return notFound();
  if (action === "review") return await routeEspnReview(app, request, services);
  if (action === "members-screenshot-review") {
    return await routeMembersScreenshotReview(app, request, services);
  }
  return notFound();
};

const routeEspnReview = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  if (services.espnLeagueSettingsImporter === undefined) {
    return knownError(503, "league_import_unavailable", "ESPN league import is unavailable.");
  }
  const season = optionalNumber(request.body.season);
  if (season === undefined || !Number.isSafeInteger(season) || season <= 0) {
    return knownError(400, "invalid_season", "Choose a valid ESPN season.");
  }
  const limited = actionRateLimitResponse(
    request,
    services.leagueImportRateLimiter,
    `${account.id}:espn-review`,
    "Too many ESPN league checks. Try again later.",
  );
  if (limited !== null) return limited;
  return {
    status: 200,
    body: await services.espnLeagueSettingsImporter({
      leagueIdOrUrl: stringValue(request.body.leagueIdOrUrl),
      season,
    }),
  };
};

const routeMembersScreenshotReview = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const account = await requireRequestAccount(app, request);
  if (request.method === "GET") {
    return { status: 200, body: { available: services.leagueMembersScreenshotAnalyzer !== undefined } };
  }
  if (request.method !== "POST") return methodNotAllowed();
  const analyzer = services.leagueMembersScreenshotAnalyzer;
  if (analyzer === undefined) {
    return knownError(503, "screenshot_import_unavailable", "Screenshot import is not configured.");
  }
  const limited = screenshotRateLimitResponse(
    request,
    services.screenshotImportRateLimiter,
    `${account.id}:league-create`,
  );
  if (limited !== null) return limited;
  return {
    status: 200,
    body: {
      import: await analyzer.analyze({
        mimeType: optionalString(request.body.mimeType) ?? "",
        base64: optionalString(request.body.base64) ?? "",
      }),
    },
  };
};
