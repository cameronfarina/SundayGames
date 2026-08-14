import type { AcceptedPlatformInvitation } from "../platformInvitations.js";
import type { RuntimeRepositories } from "./internalContracts.js";

export const createAcceptedMembershipApplier = (
  repositories: RuntimeRepositories,
): ((result: AcceptedPlatformInvitation) => Promise<void>) | undefined => {
  if (repositories.invitationRepository === repositories.postgresInvitationRepository) {
    return undefined;
  }
  return async result => {
    const season = await repositories.leagueSetupRepository.findLeagueSeason(
      result.invitation.seasonId,
    );
    if (season === null) throw new Error("The invited league season no longer exists.");
    const memberships = await repositories.leagueSetupRepository.membershipsForLeague(
      season.leagueId,
    );
    const updatedMemberships = [
      ...memberships.filter(candidate => candidate.userId !== result.membership.userId),
      result.membership,
    ];
    await repositories.leagueSetupRepository.registerLeagueSeason({
      season,
      memberships: updatedMemberships,
      createdByUserId: result.invitation.id,
    });
    if (repositories.leagueSetupRepository !== repositories.store) {
      repositories.store.registerLeagueSeason({
        season,
        memberships: updatedMemberships,
        createdByUserId: result.invitation.id,
      });
    }
  };
};
