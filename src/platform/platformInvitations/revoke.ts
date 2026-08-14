import type {
  PlatformInvitationRepository,
  PlatformInvitationView,
} from "./contracts.js";
import { PlatformInvitationError } from "./contracts.js";
import { publicInvitation } from "./views.js";

export const revokePlatformInvitation = async (
  repository: PlatformInvitationRepository,
  invitationId: string,
  revokedAt: Date,
): Promise<PlatformInvitationView> => {
  const revoked = await repository.revoke(invitationId, revokedAt);
  if (revoked === null) {
    throw new PlatformInvitationError(
      "invitation_unavailable",
      "This invitation is no longer available.",
    );
  }
  return publicInvitation(revoked);
};
