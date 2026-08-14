import { normalizeEmail } from "../../../auth.js";
import type { LeagueSeason } from "../../../leagueSeason.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import { PlatformAppError } from "../../../platformApp.js";
import { issuePlatformInvitation, reissuePlatformInvitation } from "../../../platformInvitations.js";
import type { PlatformInvitationRepository } from "../../../platformInvitations.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { knownError } from "../../responses.js";

export const issueOrRefreshTargetedInvitation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: PlatformInvitationRepository,
  season: LeagueSeason,
  invitedByUserId: string,
): Promise<PlatformHttpResponse> => {
  const teamId = stringValue(request.body.teamId);
  const team = season.teams.find(candidate => candidate.id === teamId);
  if (team === undefined) throw new PlatformAppError("team_not_found", "Choose a team from this league season.");
  const email = normalizeEmail(stringValue(request.body.email));
  const memberships = await app.listLeagueMemberships(season.leagueId);
  if (memberships.some(membership => membership.teamId === team.id)) {
    return knownError(409, "invitation_team_claimed", "That team is already claimed by a league member.");
  }
  const invitedAccount = await app.findAccountByEmail(email);
  if (invitedAccount !== null && memberships.some(membership => membership.userId === invitedAccount.id)) {
    return knownError(409, "invitation_existing_member", "That account is already an active member of this league.");
  }
  const existing = await repository.listForSeason(season.id);
  const pendingForEmail = existing.find(candidate =>
    candidate.kind === "team" && candidate.status === "pending" && candidate.email === email);
  if (pendingForEmail?.kind === "team" && pendingForEmail.teamId !== team.id) {
    return knownError(409, "invitation_email_conflict", "That email already has a pending invitation for another team.");
  }
  const pendingForTeam = existing.find(candidate =>
    candidate.kind === "team" && candidate.status === "pending" && candidate.teamId === team.id);
  if (pendingForTeam?.kind === "team" && pendingForTeam.email !== email) {
    return knownError(409, "invitation_team_conflict", "That team already has a pending invitation for another email.");
  }
  const now = request.now ?? new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1_000);
  const invitation = pendingForEmail === undefined
    ? await issuePlatformInvitation(repository, {
        leagueId: season.leagueId,
        seasonId: season.id,
        email,
        role: "member",
        ownerId: team.ownerId,
        teamId: team.id,
        ownerDisplayName: team.ownerDisplayName,
        teamDisplayName: team.displayName,
        invitedByUserId,
        now,
        expiresAt,
      })
    : await reissuePlatformInvitation(repository, {
        invitationId: pendingForEmail.id,
        invitedByUserId,
        now,
        expiresAt,
      });
  return { status: pendingForEmail === undefined ? 201 : 200, body: { invitation } };
};
