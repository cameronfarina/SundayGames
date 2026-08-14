import type { FantasyTeam, LeagueSeason } from "../leagueSeason.js";
import type { PlatformLeagueMembership } from "../leagueSetup.js";

export const teamOwnerUserIdFor = (
  team: FantasyTeam,
  leagueId: string,
  memberships: readonly PlatformLeagueMembership[],
): string | null => memberships.find(membership =>
  membership.ownerId === team.ownerId &&
  membership.teamId === team.id &&
  membership.leagueId === leagueId
)?.userId ?? null;

export const membershipIdFor = (leagueId: string, userId: string): string =>
  `league_membership:${leagueId}:${userId}`;

export const rosterRuleSetIdFor = (season: LeagueSeason): string =>
  `${season.id}:roster-rules`;
