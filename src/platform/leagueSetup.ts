import type { LeagueSeason } from "./leagueSeason.js";
import type { LeagueMembership } from "./workspacePrivacy.js";

type MaybePromise<T> = T | Promise<T>;

export interface PlatformLeagueMembership extends LeagueMembership {
  ownerId?: string;
  teamId?: string;
  inviteEmail?: string;
}

export interface RegisterLeagueSeasonRepositoryInput {
  season: LeagueSeason;
  memberships: readonly PlatformLeagueMembership[];
  createdByUserId: string;
  now?: Date | undefined;
}

export interface LeagueSetupRepository {
  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): MaybePromise<LeagueSeason>;
  findLeagueSeason(seasonId: string): MaybePromise<LeagueSeason | null>;
  hasLeagueSeasonForLeague(leagueId: string): MaybePromise<boolean>;
  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): MaybePromise<LeagueSeason | null>;
  findMembership(userId: string, leagueId: string): MaybePromise<PlatformLeagueMembership | null>;
  membershipsForLeague(leagueId: string): MaybePromise<readonly PlatformLeagueMembership[]>;
}

export const membershipKeyFor = (userId: string, leagueId: string): string => `${userId}\0${leagueId}`;
