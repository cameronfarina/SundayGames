import type { PlatformLeagueMembership } from "../../leagueSetup.js";
import type {
  ClaimLeagueSeasonTeamInput,
  JoinInvitedLeagueSeasonTeamInput,
} from "../contracts/league.js";
import type { PlatformAppContext } from "../context.js";
import { PlatformAppError } from "../errors.js";
import { cloneForRead } from "../shared.js";

export const createTeamClaimOperations = (context: PlatformAppContext) => ({
  claimLeagueSeasonTeam: async (
    input: ClaimLeagueSeasonTeamInput,
  ): Promise<PlatformLeagueMembership> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const season = await context.requireSeason(input.seasonId);
    const current = await context.requireSharedRead(account, season.leagueId);
    const team = season.teams.find(candidate =>
      candidate.id === input.teamId && candidate.ownerId === input.ownerId
    );
    if (team === undefined) {
      throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
    }
    const changesClaim = current.teamId !== undefined
      && (current.teamId !== team.id || current.ownerId !== team.ownerId);
    if (changesClaim && await context.liveDraftRooms.hasStartedRoomForSeason(season.id)) {
      throw new PlatformAppError(
        "team_claim_locked",
        "Your team claim is locked because this league's live draft has started.",
      );
    }
    const memberships = await context.leagueSetup.membershipsForLeague(season.leagueId);
    if (memberships.some(membership =>
      membership.userId !== account.id && membership.teamId === input.teamId
    )) {
      throw new PlatformAppError("team_already_claimed", "That team is already claimed.");
    }
    const membership = await context.leagueSetup.claimLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: account.id,
      ownerId: team.ownerId,
      teamId: team.id,
      now: input.now,
    });
    if (membership === null) {
      throw new PlatformAppError("team_already_claimed", "That team is already claimed.");
    }
    if (context.usesExternalLeagueSetup) {
      context.store.claimLeagueSeasonTeam({
        seasonId: season.id,
        leagueId: season.leagueId,
        userId: account.id,
        ownerId: team.ownerId,
        teamId: team.id,
        now: input.now,
      });
    }
    return cloneForRead(membership);
  },

  joinInvitedLeagueSeasonTeam: async (
    input: JoinInvitedLeagueSeasonTeamInput,
  ): Promise<PlatformLeagueMembership> => {
    const account = await context.requireAccount(input.actorSessionToken, input.now);
    const season = await context.requireSeason(input.seasonId);
    const team = season.teams.find(candidate =>
      candidate.id === input.teamId && candidate.ownerId === input.ownerId
    );
    if (team === undefined) {
      throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
    }
    const current = await context.leagueSetup.findMembership(account.id, season.leagueId);
    if (
      current?.teamId !== undefined
      && (current.teamId !== team.id || current.ownerId !== team.ownerId)
    ) {
      throw new PlatformAppError(
        "team_already_claimed",
        "Your account already has a team in this league.",
      );
    }
    const membership = await context.leagueSetup.joinLeagueSeasonTeam({
      seasonId: season.id,
      leagueId: season.leagueId,
      userId: account.id,
      ownerId: team.ownerId,
      teamId: team.id,
      role: input.role,
      invitationTokenHash: input.invitationTokenHash,
      now: input.now,
    });
    if (membership === null) {
      throw new PlatformAppError("team_already_claimed", "That team is already claimed.");
    }
    if (context.usesExternalLeagueSetup) {
      context.store.joinLeagueSeasonTeam({
        seasonId: season.id,
        leagueId: season.leagueId,
        userId: account.id,
        ownerId: team.ownerId,
        teamId: team.id,
        role: membership.role,
        now: input.now,
      });
    }
    return cloneForRead(membership);
  },
});
