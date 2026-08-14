import {
  membershipKeyFor,
  type ClaimLeagueSeasonTeamRepositoryInput,
  type JoinLeagueSeasonTeamRepositoryInput,
  type PlatformLeagueMembership,
} from "../../leagueSetup.js";
import { cloneForRead } from "../shared.js";
import type { LeagueMemoryState } from "./leagueMemoryState.js";

const teamExists = (
  state: LeagueMemoryState,
  input: ClaimLeagueSeasonTeamRepositoryInput,
): boolean => {
  const season = state.seasonsById.get(input.seasonId);
  return season !== undefined
    && season.leagueId === input.leagueId
    && season.teams.some(team => team.id === input.teamId && team.ownerId === input.ownerId);
};

const teamClaimedByOther = (
  state: LeagueMemoryState,
  input: ClaimLeagueSeasonTeamRepositoryInput,
): boolean => [...state.membershipsByUserAndLeague.values()].some(candidate =>
  candidate.leagueId === input.leagueId
  && candidate.userId !== input.userId
  && candidate.teamId === input.teamId
);

export const claimLeagueSeasonTeam = (
  state: LeagueMemoryState,
  input: ClaimLeagueSeasonTeamRepositoryInput,
): PlatformLeagueMembership | null => {
  if (!teamExists(state, input) || teamClaimedByOther(state, input)) return null;
  const key = membershipKeyFor(input.userId, input.leagueId);
  const membership = state.membershipsByUserAndLeague.get(key);
  if (membership === undefined) return null;

  const claimedMembership = {
    ...membership,
    ownerId: input.ownerId,
    teamId: input.teamId,
  };
  state.membershipsByUserAndLeague.set(key, claimedMembership);
  return cloneForRead(claimedMembership);
};

export const joinLeagueSeasonTeam = (
  state: LeagueMemoryState,
  input: JoinLeagueSeasonTeamRepositoryInput,
): PlatformLeagueMembership | null => {
  if (!teamExists(state, input) || teamClaimedByOther(state, input)) return null;
  const key = membershipKeyFor(input.userId, input.leagueId);
  const existing = state.membershipsByUserAndLeague.get(key);
  if (
    existing?.teamId !== undefined
    && (existing.teamId !== input.teamId || existing.ownerId !== input.ownerId)
  ) return null;

  const membership: PlatformLeagueMembership = {
    userId: input.userId,
    leagueId: input.leagueId,
    role: existing?.role ?? input.role,
    ownerId: input.ownerId,
    teamId: input.teamId,
  };
  state.membershipsByUserAndLeague.set(key, membership);
  return cloneForRead(membership);
};

export const replaceLeagueMemberships = (
  state: LeagueMemoryState,
  leagueId: string,
  memberships: readonly PlatformLeagueMembership[],
): void => {
  for (const [key, membership] of state.membershipsByUserAndLeague) {
    if (membership.leagueId === leagueId) state.membershipsByUserAndLeague.delete(key);
  }
  for (const membership of memberships) {
    state.membershipsByUserAndLeague.set(
      membershipKeyFor(membership.userId, membership.leagueId),
      cloneForRead(membership),
    );
  }
};
