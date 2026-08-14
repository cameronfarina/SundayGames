import type { AccountRecord } from "../../auth.js";
import type { LeagueSetupRepository, PlatformLeagueMembership } from "../../leagueSetup.js";
import {
  authorizeSharedLeagueResourceRead,
  authorizeSharedLeagueSetupMutation,
} from "../../workspacePrivacy.js";
import { PlatformAppError } from "../errors.js";
import type { LeagueSetupMirror } from "./leagueSetupMirror.js";

export interface MembershipAccess {
  requireSharedRead(account: AccountRecord, leagueId: string): Promise<PlatformLeagueMembership>;
  requireSharedMutation(account: AccountRecord, leagueId: string): Promise<PlatformLeagueMembership>;
}

const membershipError = (mutate: boolean): PlatformAppError => new PlatformAppError(
  "membership_required",
  mutate
    ? "Join this league before changing shared league data."
    : "Join this league before viewing shared league data.",
);

export const createMembershipAccess = (
  leagueSetup: LeagueSetupRepository,
  mirror: LeagueSetupMirror,
): MembershipAccess => {
  const requireMembership = async (
    account: AccountRecord,
    leagueId: string,
    mutate: boolean,
  ): Promise<PlatformLeagueMembership> => {
    const memberships = await leagueSetup.membershipsForLeague(leagueId);
    const decision = mutate
      ? authorizeSharedLeagueSetupMutation({ id: account.id }, { leagueId }, memberships)
      : authorizeSharedLeagueResourceRead({ id: account.id }, { leagueId }, memberships);
    if (!decision.allowed) {
      if (mutate && decision.reason !== "league_membership_required") {
        throw new PlatformAppError(
          "shared_mutation_denied",
          "Only league owners and admins can change shared draft data.",
        );
      }
      throw membershipError(mutate);
    }
    const membership = await leagueSetup.findMembership(account.id, leagueId);
    if (membership === null) throw membershipError(mutate);
    mirror.memberships(leagueId, memberships);
    return membership;
  };

  return {
    requireSharedRead: (account, leagueId) => requireMembership(account, leagueId, false),
    requireSharedMutation: (account, leagueId) => requireMembership(account, leagueId, true),
  };
};
