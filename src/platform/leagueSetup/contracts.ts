import type { LeagueSeason } from "../leagueSeason.js";
import type { LeagueMembership } from "../workspacePrivacy.js";

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
  expectedSetupRevision?: string;
  membershipWriteMode?: "replace" | "preserve";
  enforceCreationLimits?: boolean;
  /**
   * Importing a provider account creates one league per league the owner
   * already plays in, all at once, which the per-hour window exists to stop for
   * hand-made leagues. Turning it off never touches the active-league quota.
   */
  enforceCreationRateLimit?: boolean;
  now?: Date | undefined;
}

export interface LeagueCreationLimits {
  maxActiveLeaguesPerAccount: number;
  maxCreatedLeaguesPerWindow: number;
  creationWindowMs: number;
}

export interface LeagueCreationRecord {
  leagueId: string;
  createdByUserId: string;
  createdAt: Date;
  archivedAt?: Date;
  archivedByUserId?: string;
}

export interface ArchiveLeagueRepositoryInput {
  leagueId: string;
  archivedByUserId: string;
  now?: Date | undefined;
}

export interface ClaimLeagueSeasonTeamRepositoryInput {
  seasonId: string;
  leagueId: string;
  userId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}

export interface JoinLeagueSeasonTeamRepositoryInput
  extends ClaimLeagueSeasonTeamRepositoryInput {
  role: PlatformLeagueMembership["role"];
  invitationTokenHash?: string;
}

export interface LeagueSetupRepository {
  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): MaybePromise<LeagueSeason>;
  registerLeagueSeasonWithConnection?(
    input: RegisterLeagueSeasonRepositoryInput,
    leagueConnectionId: string,
  ): MaybePromise<LeagueSeason>;
  archiveLeague(input: ArchiveLeagueRepositoryInput): MaybePromise<boolean>;
  isLeagueArchived(leagueId: string): MaybePromise<boolean>;
  claimLeagueSeasonTeam(
    input: ClaimLeagueSeasonTeamRepositoryInput,
  ): MaybePromise<PlatformLeagueMembership | null>;
  joinLeagueSeasonTeam(
    input: JoinLeagueSeasonTeamRepositoryInput,
  ): MaybePromise<PlatformLeagueMembership | null>;
  findLeagueSeason(seasonId: string): MaybePromise<LeagueSeason | null>;
  hasLeagueSeasonForLeague(leagueId: string): MaybePromise<boolean>;
  findLeagueSeasonForLeagueYear(
    leagueId: string,
    seasonYear: number,
  ): MaybePromise<LeagueSeason | null>;
  findMembership(
    userId: string,
    leagueId: string,
  ): MaybePromise<PlatformLeagueMembership | null>;
  membershipsForLeague(leagueId: string): MaybePromise<readonly PlatformLeagueMembership[]>;
}
