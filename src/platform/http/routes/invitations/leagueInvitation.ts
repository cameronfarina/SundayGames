import { issuePlatformLeagueInvitation, reissuePlatformInvitation } from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";

export const issueOrRefreshLeagueInvitation = async (
  repository: PlatformInvitationRepository,
  input: {
    leagueId: string;
    seasonId: string;
    userId: string;
    now: Date;
    tokenSecret: string;
  },
) => {
  const pending = (await repository.listForSeason(input.seasonId)).find(candidate =>
    candidate.kind === "league" && candidate.status === "pending");
  const expiresAt = new Date(input.now.getTime() + 30 * 24 * 60 * 60 * 1_000);
  const invitation = pending === undefined
    ? await issuePlatformLeagueInvitation(repository, {
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        invitedByUserId: input.userId,
        now: input.now,
        expiresAt,
      }, { leagueTokenSecret: input.tokenSecret })
    : await reissuePlatformInvitation(repository, {
        invitationId: pending.id,
        invitedByUserId: input.userId,
        now: input.now,
        expiresAt,
      }, { leagueTokenSecret: input.tokenSecret });
  return { status: pending === undefined ? 201 : 200, body: { invitation } };
};
