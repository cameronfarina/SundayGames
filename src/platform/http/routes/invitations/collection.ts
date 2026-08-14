import { listPlatformInvitations } from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { optionalString, stringValue } from "../../request/values.js";
import { methodNotAllowed } from "../../responses.js";
import { issueOrRefreshLeagueInvitation } from "./leagueInvitation.js";
import { issueOrRefreshTargetedInvitation } from "./targetedInvitation.js";

export const routeInvitationCollection = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: PlatformInvitationRepository,
  tokenSecret: string,
): Promise<PlatformHttpResponse> => {
  const seasonId = stringValue(request.query.seasonId);
  if (request.method === "GET") {
    await requireSeasonManager(app, request, seasonId);
    const season = await app.getLeagueSeason({ actorSessionToken: request.sessionToken, seasonId, now: request.now });
    const claimedTeamIds = (await app.listLeagueMemberships(season.leagueId))
      .flatMap(membership => membership.teamId === undefined ? [] : [membership.teamId]);
    return {
      status: 200,
      body: {
        invitations: await listPlatformInvitations(repository, seasonId, { leagueTokenSecret: tokenSecret }),
        claimedTeamIds,
      },
    };
  }
  if (request.method !== "POST") return methodNotAllowed();
  const submittedSeasonId = stringValue(request.body.seasonId);
  const account = await requireSeasonManager(app, request, submittedSeasonId);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: submittedSeasonId,
    now: request.now,
  });
  const hasTargetedFields = optionalString(request.body.teamId) !== undefined
    || optionalString(request.body.email) !== undefined;
  return hasTargetedFields
    ? await issueOrRefreshTargetedInvitation(app, request, repository, season, account.id)
    : await issueOrRefreshLeagueInvitation(repository, {
        leagueId: season.leagueId,
        seasonId: season.id,
        userId: account.id,
        now: request.now ?? new Date(),
        tokenSecret,
      });
};
