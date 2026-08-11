import { createHash } from "node:crypto";
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
  expectedSetupRevision?: string;
  membershipWriteMode?: "replace" | "preserve";
  now?: Date | undefined;
}

export class LeagueSetupWriteConflictError extends Error {
  constructor() {
    super("League setup changed after this review was created. Analyze the screenshot again.");
    this.name = "LeagueSetupWriteConflictError";
  }
}

export const leagueSeasonSetupRevision = (season: LeagueSeason): string =>
  createHash("sha256").update(JSON.stringify({
    id: season.id,
    league: season.league,
    settings: season.settings,
    setupStatus: season.setupStatus,
    teams: [...season.teams]
      .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition || left.id.localeCompare(right.id))
      .map(team => ({
        id: team.id,
        ownerId: team.ownerId,
        ownerDisplayName: team.ownerDisplayName,
        managerDisplayNames: team.managerDisplayNames ?? [],
        abbreviation: team.abbreviation ?? "",
        displayName: team.displayName,
        draftOrderPosition: team.draftOrderPosition,
      })),
  })).digest("base64url");

export interface ClaimLeagueSeasonTeamRepositoryInput {
  seasonId: string;
  leagueId: string;
  userId: string;
  ownerId: string;
  teamId: string;
  now?: Date | undefined;
}

export interface LeagueSetupRepository {
  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): MaybePromise<LeagueSeason>;
  claimLeagueSeasonTeam(input: ClaimLeagueSeasonTeamRepositoryInput): MaybePromise<PlatformLeagueMembership | null>;
  findLeagueSeason(seasonId: string): MaybePromise<LeagueSeason | null>;
  hasLeagueSeasonForLeague(leagueId: string): MaybePromise<boolean>;
  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): MaybePromise<LeagueSeason | null>;
  findMembership(userId: string, leagueId: string): MaybePromise<PlatformLeagueMembership | null>;
  membershipsForLeague(leagueId: string): MaybePromise<readonly PlatformLeagueMembership[]>;
}

export const membershipKeyFor = (userId: string, leagueId: string): string => `${userId}\0${leagueId}`;
