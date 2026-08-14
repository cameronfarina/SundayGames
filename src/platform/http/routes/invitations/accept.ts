import {
  acceptPlatformInvitation,
  hashPlatformInvitationToken,
} from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import { requireRequestAccount } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { knownError, methodNotAllowed } from "../../responses.js";

export const routeInvitationAccept = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  repository: PlatformInvitationRepository,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const account = await requireRequestAccount(app, request);
  const token = stringValue(request.body.token);
  const pending = await repository.findByTokenHash(hashPlatformInvitationToken(token));
  if (pending?.kind === "team") {
    const memberships = await app.listLeagueMemberships(pending.leagueId);
    if (memberships.some(membership => membership.userId === account.id)) {
      return knownError(409, "invitation_existing_member", "This account is already an active member of the league.");
    }
    if (memberships.some(membership => membership.teamId === pending.teamId)) {
      return knownError(409, "invitation_team_claimed", "The invited team is already claimed by a league member.");
    }
  }
  const result = await acceptPlatformInvitation(repository, { token, account, now: request.now ?? new Date() });
  await services.applyAcceptedMembership?.(result);
  return { status: 200, body: result };
};
