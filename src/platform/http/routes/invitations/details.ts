import { PlatformInvitationError, hashPlatformInvitationToken } from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import type { LeagueSetupRepository } from "../../../leagueSetup.js";
import type { PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeInvitationDetails = async (
  request: ParsedPlatformHttpRequest,
  repository: PlatformInvitationRepository,
  leagueSetup: LeagueSetupRepository | undefined,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "GET") return methodNotAllowed();
  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(stringValue(request.query.token)));
  const now = request.now ?? new Date();
  if (invitation === null || invitation.status !== "pending" || invitation.expiresAt < now) {
    const isExpired = invitation !== null && invitation.expiresAt < now;
    throw new PlatformInvitationError(
      isExpired ? "invitation_expired" : "invitation_unavailable",
      isExpired
        ? "This invitation has expired. Ask the commissioner for a new link."
        : "This invitation is no longer available.",
    );
  }
  if (leagueSetup === undefined) {
    return knownError(503, "invitations_unavailable", "League invitations are not configured.");
  }
  const season = await leagueSetup.findLeagueSeason(invitation.seasonId);
  if (season === null) {
    throw new PlatformInvitationError("invitation_unavailable", "This league season is no longer available.");
  }
  const memberships = await leagueSetup.membershipsForLeague(season.leagueId);
  const claimedTeamIds = new Set(memberships.flatMap(membership =>
    membership.teamId === undefined ? [] : [membership.teamId]));
  return {
    status: 200,
    body: {
      invitation: {
        id: invitation.id,
        seasonId: invitation.seasonId,
        kind: invitation.kind,
        ...(invitation.kind === "team" ? { teamId: invitation.teamId } : {}),
      },
      league: { id: season.leagueId, name: season.league.name, seasonYear: season.seasonYear },
      teams: [...season.teams]
        .filter(team => invitation.kind === "league" || team.id === invitation.teamId)
        .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
        .map(team => ({
          id: team.id,
          ownerId: team.ownerId,
          name: team.displayName,
          managerNames: team.managerDisplayNames,
          status: claimedTeamIds.has(team.id) ? "claimed" : "available",
        })),
    },
  };
};
