import type { LeagueSeason } from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../platformApp.js";
import type {
  SeedLocalE2eAccount,
  SeedLocalE2eOpenTeam,
  SeedLocalE2eTeamClaim,
} from "./contracts.js";
import { commissionerOwner, managerOwner } from "./fixtures.js";

export const teamByOwner = (
  season: LeagueSeason,
  ownerDisplayName: string,
): LeagueSeason["teams"][number] => {
  const team = season.teams.find(candidate => candidate.ownerDisplayName === ownerDisplayName);
  if (team === undefined) throw new Error(`Expected ${ownerDisplayName} team in local E2E seed.`);
  return team;
};

export const membershipFor = (
  account: SeedLocalE2eAccount,
  season: LeagueSeason,
  ownerDisplayName: string,
): PlatformLeagueMembership => {
  const team = teamByOwner(season, ownerDisplayName);
  return {
    userId: account.accountId,
    leagueId: season.leagueId,
    role: ownerDisplayName === commissionerOwner ? "owner" : "member",
    ownerId: team.ownerId,
    teamId: team.id,
  };
};

export const teamClaimFor = (
  season: LeagueSeason,
  ownerDisplayName: string,
  membership: PlatformLeagueMembership,
): SeedLocalE2eTeamClaim => {
  const team = teamByOwner(season, ownerDisplayName);
  return {
    userId: membership.userId,
    leagueId: membership.leagueId,
    role: membership.role,
    ownerId: membership.ownerId ?? team.ownerId,
    teamId: membership.teamId ?? team.id,
    ownerDisplayName: team.ownerDisplayName,
    teamDisplayName: team.displayName,
  };
};

export const openTeamsFor = (season: LeagueSeason): readonly SeedLocalE2eOpenTeam[] =>
  season.teams
    .filter(team => team.ownerDisplayName !== commissionerOwner && team.ownerDisplayName !== managerOwner)
    .map(team => ({
      ownerDisplayName: team.ownerDisplayName,
      teamDisplayName: team.displayName,
    }));
