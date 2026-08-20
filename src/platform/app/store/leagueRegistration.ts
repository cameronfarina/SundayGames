import type { LeagueSeason } from "../../leagueSeason.js";
import {
  assertLeagueCreationAllowed,
  LeagueSetupWriteConflictError,
  leagueSeasonSetupRevision,
  type ArchiveLeagueRepositoryInput,
  type RegisterLeagueSeasonRepositoryInput,
} from "../../leagueSetup.js";
import { cloneForRead } from "../shared.js";
import type { LeagueMemoryState } from "./leagueMemoryState.js";
import { replaceLeagueMemberships } from "./teamMemberships.js";

export const registerLeagueSeason = (
  state: LeagueMemoryState,
  input: RegisterLeagueSeasonRepositoryInput,
): LeagueSeason => {
  const currentSeason = state.seasonsById.get(input.season.id);
  if (
    input.expectedSetupRevision !== undefined
    && (currentSeason === undefined
      || leagueSeasonSetupRevision(currentSeason) !== input.expectedSetupRevision)
  ) {
    throw new LeagueSetupWriteConflictError();
  }
  const createsLeague = ![...state.seasonsById.values()].some(
    season => season.leagueId === input.season.leagueId,
  );
  if (createsLeague && input.enforceCreationLimits !== false) {
    assertLeagueCreationAllowed({
      records: [...state.creationRecordsByLeagueId.values()],
      createdByUserId: input.createdByUserId,
      now: input.now ?? new Date(),
      limits: state.creationLimits,
      ...(input.enforceCreationRateLimit === undefined
        ? {}
        : { enforceRateLimit: input.enforceCreationRateLimit }),
    });
  }
  const storedSeason = cloneForRead(input.season);
  state.seasonsById.set(storedSeason.id, storedSeason);
  if (createsLeague) {
    state.creationRecordsByLeagueId.set(storedSeason.leagueId, {
      leagueId: storedSeason.leagueId,
      createdByUserId: input.createdByUserId,
      createdAt: input.now ?? new Date(),
    });
  }
  if (input.membershipWriteMode !== "preserve") {
    replaceLeagueMemberships(state, storedSeason.leagueId, input.memberships);
  }

  return cloneForRead(storedSeason);
};

export const archiveLeague = (
  state: LeagueMemoryState,
  input: ArchiveLeagueRepositoryInput,
): boolean => {
  if (![...state.seasonsById.values()].some(season => season.leagueId === input.leagueId)) return false;
  const record = state.creationRecordsByLeagueId.get(input.leagueId);
  if (record === undefined) return false;
  if (record.archivedAt !== undefined) return true;

  state.creationRecordsByLeagueId.set(input.leagueId, {
    ...record,
    archivedAt: input.now ?? new Date(),
    archivedByUserId: input.archivedByUserId,
  });
  return true;
};
