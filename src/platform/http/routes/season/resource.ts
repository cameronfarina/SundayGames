import { assessLeagueSeasonReadiness } from "../../../leagueSeason.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";
import { registerSeason } from "./registerSeason.js";

export const routeSeasonPublish = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  await requireSeasonManager(app, request, seasonId);
  const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId, now: request.now });
  if (season.setupStatus === "published") return { status: 200, body: { season } };
  if (request.body.confirmed !== true) {
    return knownError(
      400,
      "season_review_confirmation_required",
      "Review teams, scoring, roster rules, draft history, and keepers before publishing.",
    );
  }
  const readiness = assessLeagueSeasonReadiness(season);
  if (!readiness.canPublish) {
    return knownError(409, "season_not_ready", readiness.blockers[0] ?? "Resolve league setup blockers before publishing.");
  }
  const publishedSeason = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: { ...season, setupStatus: "published" },
    memberships: await app.listLeagueMemberships(season.leagueId),
    membershipWriteMode: "preserve",
    now: request.now,
  });
  return { status: 200, body: { season: publishedSeason } };
};

export const routeSeasonTeamClaim = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const membership = await app.claimLeagueSeasonTeam({
    actorSessionToken: request.sessionToken,
    seasonId,
    ownerId: stringValue(request.body.ownerId),
    teamId: stringValue(request.body.teamId),
    now: request.now,
  });
  return { status: 200, body: { membership } };
};

export const routeSeasonResource = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
): Promise<PlatformHttpResponse> => {
  if (request.method === "GET") {
    const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId, now: request.now });
    const claimedTeamIds = new Set(
      (await app.listLeagueMemberships(season.leagueId))
        .map(membership => membership.teamId)
        .filter((teamId): teamId is string => teamId !== undefined),
    );
    return {
      status: 200,
      body: { season, claimableTeams: season.teams.filter(team => !claimedTeamIds.has(team.id)) },
    };
  }
  if (request.method === "PUT") return await registerSeason(app, request, seasonId);
  return methodNotAllowed();
};
