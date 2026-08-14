import {
  PlatformInvitationError,
  reissuePlatformInvitation,
  revokePlatformInvitation,
} from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import { requireSeasonManager } from "../../auth/access.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed } from "../../responses.js";

export const routeInvitationManagement = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: PlatformInvitationRepository,
  invitationId: string,
  action: "reissue" | "revoke",
  tokenSecret: string,
): Promise<PlatformHttpResponse> => {
  if (request.method !== "POST") return methodNotAllowed();
  const invitation = await repository.findById(invitationId);
  if (invitation === null) {
    throw new PlatformInvitationError("invitation_not_found", "This invitation could not be found.");
  }
  const account = await requireSeasonManager(app, request, invitation.seasonId);
  if (action === "revoke") {
    return {
      status: 200,
      body: {
        invitation: await revokePlatformInvitation(
          repository,
          invitation.id,
          request.now ?? new Date(),
        ),
      },
    };
  }

  const issuedAt = request.now ?? new Date();
  return {
    status: 200,
    body: {
      invitation: await reissuePlatformInvitation(repository, {
        invitationId: invitation.id,
        invitedByUserId: account.id,
        now: issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1_000),
      }, {
        leagueTokenSecret: tokenSecret,
      }),
    },
  };
};
