import {
  issuePlatformInvitation,
  reissuePlatformInvitation,
  type PlatformInvitationRepository,
  type PlatformInvitationView,
} from "../platformInvitations.js";
import type {
  PlatformLeagueSetupImportApplyBody,
  PlatformLeagueSetupImportPendingInvite,
} from "./contracts.js";

interface DeliverSetupInvitationsInput {
  repository?: PlatformInvitationRepository;
  actorAccountId: string | null;
  seasonId: string;
  pendingInvites: readonly PlatformLeagueSetupImportPendingInvite[];
  now?: Date | undefined;
}

interface DeliveredSetupInvitations {
  invitations: readonly PlatformInvitationView[];
  invitationFailures: PlatformLeagueSetupImportApplyBody["invitationFailures"];
}

const normalizeEmailKey = (email: string): string => email.trim().toLowerCase();

export const deliverSetupInvitations = async (
  input: DeliverSetupInvitationsInput,
): Promise<DeliveredSetupInvitations> => {
  if (input.repository === undefined || input.actorAccountId === null) {
    return { invitations: [], invitationFailures: [] };
  }
  const repository = input.repository;
  const actorAccountId = input.actorAccountId;
  const invitationNow = input.now ?? new Date();
  const expiresAt = new Date(invitationNow.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const existingInvitations = await repository.listForSeason(input.seasonId);
  const results = await Promise.allSettled(input.pendingInvites.map(invite => {
    const existing = existingInvitations.find(candidate =>
      candidate.kind === "team"
        && candidate.status === "pending"
        && candidate.teamId === invite.teamId
        && candidate.email === normalizeEmailKey(invite.email)
    );
    return existing === undefined
      ? issuePlatformInvitation(repository, {
          ...invite,
          seasonId: input.seasonId,
          invitedByUserId: actorAccountId,
          now: invitationNow,
          expiresAt,
        })
      : reissuePlatformInvitation(repository, {
          invitationId: existing.id,
          invitedByUserId: actorAccountId,
          now: invitationNow,
          expiresAt,
        });
  }));
  const invitations: PlatformInvitationView[] = [];
  const invitationFailures: PlatformLeagueSetupImportApplyBody["invitationFailures"][number][] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      invitations.push(result.value);
      return;
    }
    const invite = input.pendingInvites[index];
    if (invite === undefined) return;
    invitationFailures.push({
      email: invite.email,
      teamId: invite.teamId,
      message: result.reason instanceof Error
        ? result.reason.message
        : "Invitation could not be issued.",
    });
  });
  return { invitations, invitationFailures };
};
