import type { AccountRecord } from "../../auth.js";
import type { LeagueSeason } from "../../leagueSeason.js";
import type { PrivateTeamContextInput } from "../contracts/league.js";
import { PlatformAppError } from "../errors.js";
import type { MembershipAccess } from "./membershipAccess.js";
import type { SeasonAccess } from "./seasonAccess.js";

type PrivateTeamReference = Omit<PrivateTeamContextInput, "actorSessionToken" | "now">;

export interface PrivateTeamAccess {
  requirePrivateTeamContext(account: AccountRecord, input: PrivateTeamReference): Promise<LeagueSeason>;
  canReadPrivateTeamContext(account: AccountRecord, input: PrivateTeamReference): Promise<boolean>;
}

export const createPrivateTeamAccess = (
  seasons: SeasonAccess,
  memberships: MembershipAccess,
): PrivateTeamAccess => {
  const requirePrivateTeamContext = async (
    account: AccountRecord,
    input: PrivateTeamReference,
  ): Promise<LeagueSeason> => {
    const season = await seasons.requireSeason(input.seasonId);
    const membership = await memberships.requireSharedRead(account, input.leagueId);
    if (season.leagueId !== input.leagueId) {
      throw new PlatformAppError("league_not_found", "League does not match this season.");
    }
    const team = season.teams.find(candidate => candidate.id === input.teamId);
    if (team === undefined || team.ownerId !== input.ownerId) {
      throw new PlatformAppError("team_not_found", "Team was not found in this league season.");
    }
    if (membership.teamId === undefined || membership.ownerId === undefined) {
      throw new PlatformAppError("team_claim_required", "Claim your team before creating private prep.");
    }
    if (membership.teamId !== input.teamId || membership.ownerId !== input.ownerId) {
      throw new PlatformAppError("private_team_required", "Private prep can only use your claimed team.");
    }
    return season;
  };

  return {
    requirePrivateTeamContext,
    canReadPrivateTeamContext: async (account, input) => {
      try {
        await requirePrivateTeamContext(account, input);
        return true;
      } catch (error) {
        if (error instanceof PlatformAppError) return false;
        throw error;
      }
    },
  };
};
