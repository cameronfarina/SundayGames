import type { LeagueSetupRepository } from "../../../leagueSetup.js";
import { PlatformAppError } from "../../../platformApp.js";
import {
  acceptPlatformInvitation,
  hashPlatformInvitationToken,
  joinPlatformLeagueInvitation,
  PlatformInvitationError,
} from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeInvitationClaim = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  repository: PlatformInvitationRepository,
  leagueSetup: LeagueSetupRepository | undefined,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  const token = stringValue(request.body.token);
  const teamId = stringValue(request.body.teamId);
  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(token));
  if (invitation === null) {
    throw new PlatformInvitationError("invitation_not_found", "This invitation link is invalid. Ask the commissioner for a new link.");
  }
  const now = request.now ?? new Date();
  if (invitation.status !== "pending") {
    throw new PlatformInvitationError("invitation_unavailable", "This invitation is no longer available.");
  }
  if (invitation.expiresAt < now) {
    throw new PlatformInvitationError("invitation_expired", "This invitation has expired. Ask the commissioner for a new link.");
  }
  if (leagueSetup === undefined) {
    return knownError(503, "invitations_unavailable", "League invitations are not configured.");
  }
  const season = await leagueSetup.findLeagueSeason(invitation.seasonId);
  const team = season?.teams.find(candidate => candidate.id === teamId);
  if (season === null || team === undefined) {
    throw new PlatformAppError("team_not_found", "Choose a team from this league season.");
  }
  const currentMembership = await leagueSetup.findMembership(account.id, season.leagueId);
  if (currentMembership?.teamId !== undefined) {
    if (currentMembership.teamId !== team.id) {
      return knownError(409, "team_already_selected", "Your account already has a team in this league.");
    }
    return { status: 200, body: { membership: currentMembership } };
  }
  if (invitation.kind === "team") {
    if (invitation.teamId !== team.id) {
      throw new PlatformAppError("team_not_found", "Choose the team assigned by this invitation.");
    }
    const memberships = await app.listLeagueMemberships(invitation.leagueId);
    if (memberships.some(membership => membership.teamId === invitation.teamId)) {
      return knownError(409, "invitation_team_claimed", "The invited team is already claimed by a league member.");
    }
    const accepted = await acceptPlatformInvitation(repository, { token, account, now });
    await services.applyAcceptedMembership?.(accepted);
    return { status: 200, body: accepted };
  }
  const joined = await joinPlatformLeagueInvitation(repository, { token, account, now });
  const membership = await app.joinInvitedLeagueSeasonTeam({
    actorSessionToken: request.sessionToken,
    seasonId: season.id,
    ownerId: team.ownerId,
    teamId: team.id,
    role: joined.membership.role,
    invitationTokenHash: hashPlatformInvitationToken(token),
    now: request.now,
  });
  return { status: 200, body: { invitation: joined.invitation, membership } };
};
