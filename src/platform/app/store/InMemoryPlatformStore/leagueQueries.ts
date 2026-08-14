import type { LeagueSeason } from "../../../leagueSeason.js";
import type {
  PlatformLeagueMembership,
} from "../../../leagueSetup.js";
import type { LiveDraftRoomAuthorizer } from "../../../liveDraftRooms.js";
import { cloneForRead } from "../../shared.js";
import type { LeagueMemoryState } from "../leagueMemoryState.js";

const mutationRoles = new Set(["owner", "admin"]);

export const isLeagueArchived = (state: LeagueMemoryState, leagueId: string): boolean =>
  state.creationRecordsByLeagueId.get(leagueId)?.archivedAt !== undefined;

export const findLeagueSeason = (
  state: LeagueMemoryState,
  seasonId: string,
): LeagueSeason | null => {
  const season = state.seasonsById.get(seasonId);
  return season === undefined ? null : cloneForRead(season);
};

export const hasLeagueSeasonForLeague = (state: LeagueMemoryState, leagueId: string): boolean =>
  [...state.seasonsById.values()].some(season => season.leagueId === leagueId);

export const findLeagueSeasonForLeagueYear = (
  state: LeagueMemoryState,
  leagueId: string,
  seasonYear: number,
): LeagueSeason | null => {
  const season = [...state.seasonsById.values()].find(
    candidate => candidate.leagueId === leagueId && candidate.seasonYear === seasonYear,
  );
  return season === undefined ? null : cloneForRead(season);
};

export const findMembership = (
  state: LeagueMemoryState,
  userId: string,
  leagueId: string,
): PlatformLeagueMembership | null => {
  const membership = [...state.membershipsByUserAndLeague.values()].find(
    candidate => candidate.userId === userId && candidate.leagueId === leagueId,
  );
  return membership === undefined ? null : cloneForRead(membership);
};

export const membershipsForLeague = (
  state: LeagueMemoryState,
  leagueId: string,
): readonly PlatformLeagueMembership[] => [...state.membershipsByUserAndLeague.values()]
  .filter(membership => membership.leagueId === leagueId)
  .map(cloneForRead);

export const createLiveDraftRoomAuthorizer = (
  state: LeagueMemoryState,
): LiveDraftRoomAuthorizer => ({ actor, action, room }) => {
  const membership = findMembership(state, actor.userId, room.leagueId);
  if (actor.leagueId !== room.leagueId || membership === null) return false;
  return action === "read" || mutationRoles.has(membership.role);
};
