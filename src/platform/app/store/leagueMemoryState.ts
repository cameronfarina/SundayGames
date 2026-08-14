import type { LeagueSeason } from "../../leagueSeason.js";
import {
  defaultLeagueCreationLimits,
  membershipKeyFor,
  normalizeLeagueCreationLimits,
  type LeagueCreationLimits,
  type LeagueCreationRecord,
  type PlatformLeagueMembership,
} from "../../leagueSetup.js";
import { cloneForRead } from "../shared.js";

export interface LeagueMemoryState {
  readonly seasonsById: Map<string, LeagueSeason>;
  readonly membershipsByUserAndLeague: Map<string, PlatformLeagueMembership>;
  readonly creationRecordsByLeagueId: Map<string, LeagueCreationRecord>;
  readonly creationLimits: LeagueCreationLimits;
}

export interface LeagueMemorySnapshot {
  readonly leagueSeasons: readonly LeagueSeason[];
  readonly leagueCreationRecords: readonly LeagueCreationRecord[];
  readonly memberships: readonly PlatformLeagueMembership[];
}

export const createLeagueMemoryState = (
  limits?: LeagueCreationLimits,
): LeagueMemoryState => ({
  seasonsById: new Map(),
  membershipsByUserAndLeague: new Map(),
  creationRecordsByLeagueId: new Map(),
  creationLimits: normalizeLeagueCreationLimits(limits ?? defaultLeagueCreationLimits),
});

export const leagueMemorySnapshot = (state: LeagueMemoryState): LeagueMemorySnapshot => ({
  leagueSeasons: [...state.seasonsById.values()].map(cloneForRead),
  leagueCreationRecords: [...state.creationRecordsByLeagueId.values()].map(cloneForRead),
  memberships: [...state.membershipsByUserAndLeague.values()].map(cloneForRead),
});

export const restoreLeagueMemoryState = (
  state: LeagueMemoryState,
  snapshot: LeagueMemorySnapshot,
): void => {
  state.seasonsById.clear();
  state.membershipsByUserAndLeague.clear();
  state.creationRecordsByLeagueId.clear();

  for (const season of snapshot.leagueSeasons) {
    state.seasonsById.set(season.id, cloneForRead(season));
  }
  for (const record of snapshot.leagueCreationRecords) {
    state.creationRecordsByLeagueId.set(record.leagueId, cloneForRead(record));
  }
  for (const membership of snapshot.memberships) {
    state.membershipsByUserAndLeague.set(
      membershipKeyFor(membership.userId, membership.leagueId),
      cloneForRead(membership),
    );
  }
};

export const recoverMissingLeagueCreationRecords = (
  state: LeagueMemoryState,
): void => {
  const knownLeagueIds = new Set([...state.seasonsById.values()].map(season => season.leagueId));
  for (const leagueId of knownLeagueIds) {
    if (state.creationRecordsByLeagueId.has(leagueId)) continue;
    const owner = [...state.membershipsByUserAndLeague.values()].find(
      membership => membership.leagueId === leagueId && membership.role === "owner",
    );
    if (owner !== undefined) {
      state.creationRecordsByLeagueId.set(leagueId, {
        leagueId,
        createdByUserId: owner.userId,
        createdAt: new Date(0),
      });
    }
  }
};
