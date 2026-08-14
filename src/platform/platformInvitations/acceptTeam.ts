import type { PlatformInvitationRepository } from "./contracts.js";
import { PlatformInvitationError } from "./contracts.js";
import type {
  AcceptPlatformInvitationInput,
  AcceptedPlatformInvitation,
} from "./operationContracts.js";
import { normalizedInvitationEmail } from "./records.js";
import { hashPlatformInvitationToken } from "./tokens.js";
import { publicInvitation } from "./views.js";

export const acceptPlatformInvitation = async (
  repository: PlatformInvitationRepository,
  input: AcceptPlatformInvitationInput,
): Promise<AcceptedPlatformInvitation> => {
  const invitation = await repository.findByTokenHash(
    hashPlatformInvitationToken(input.token),
  );
  if (invitation === null) {
    throw new PlatformInvitationError(
      "invitation_not_found",
      "This invitation link is invalid. Ask the commissioner for a new link.",
    );
  }
  if (invitation.status !== "pending") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  if (invitation.kind !== "team") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "Choose a team from the league invitation page.",
    );
  }
  if (
    normalizedInvitationEmail(input.account.email) !==
    normalizedInvitationEmail(invitation.email)
  ) {
    throw new PlatformInvitationError(
      "invitation_email_mismatch",
      "This invitation cannot be accepted by the signed-in account.",
    );
  }
  if (input.now.getTime() > invitation.expiresAt.getTime()) {
    throw new PlatformInvitationError(
      "invitation_expired",
      "This invitation has expired. Ask the commissioner for a new link.",
    );
  }
  const accepted = await repository.accept(invitation.id, input.account.id, input.now);
  if (accepted === null || accepted.kind !== "team") {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  const invitationView = publicInvitation(accepted);
  if (invitationView.kind !== "team") {
    throw new Error("Accepted invitation changed kind.");
  }
  return {
    invitation: invitationView,
    membership: {
      userId: input.account.id,
      leagueId: accepted.leagueId,
      role: accepted.role,
      ownerId: accepted.ownerId,
      teamId: accepted.teamId,
      inviteEmail: accepted.email,
    },
  };
};
