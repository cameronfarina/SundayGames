import type { PlatformInvitationRepository } from "./contracts.js";
import { PlatformInvitationError } from "./contracts.js";
import type {
  AcceptPlatformInvitationInput,
  JoinedPlatformLeagueInvitation,
} from "./operationContracts.js";
import { hashPlatformInvitationToken } from "./tokens.js";
import { publicInvitation } from "./views.js";

export const joinPlatformLeagueInvitation = async (
  repository: PlatformInvitationRepository,
  input: AcceptPlatformInvitationInput,
): Promise<JoinedPlatformLeagueInvitation> => {
  const invitation = await repository.findByTokenHash(
    hashPlatformInvitationToken(input.token),
  );
  if (invitation === null) {
    throw new PlatformInvitationError(
      "invitation_not_found",
      "This invitation link is invalid. Ask the commissioner for a new link.",
    );
  }
  if (invitation.kind !== "league" || invitation.status !== "pending") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (input.now.getTime() > invitation.expiresAt.getTime()) {
    throw new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    );
  }
  const invitationView = publicInvitation(invitation);
  if (invitationView.kind !== "league") {
    throw new Error("Joined invitation changed kind.");
  }
  return {
    invitation: invitationView,
    membership: {
      userId: input.account.id,
      leagueId: invitation.leagueId,
      role: invitation.role,
    },
  };
};
