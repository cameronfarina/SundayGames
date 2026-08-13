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
  enforceCreationLimits?: boolean;
  now?: Date | undefined;
}

export interface LeagueCreationLimits {
  maxActiveLeaguesPerAccount: number;
  maxCreatedLeaguesPerWindow: number;
  creationWindowMs: number;
}

export const defaultLeagueCreationLimits: LeagueCreationLimits = {
  maxActiveLeaguesPerAccount: 20,
  maxCreatedLeaguesPerWindow: 5,
  creationWindowMs: 60 * 60 * 1_000,
};

export interface LeagueCreationRecord {
  leagueId: string;
  createdByUserId: string;
  createdAt: Date;
}

export type LeagueCreationLimitErrorCode =
  | "active_league_quota_reached"
  | "league_creation_rate_limited";

export class LeagueCreationLimitError extends Error {
  constructor(
    readonly code: LeagueCreationLimitErrorCode,
    message: string,
    readonly retryAfterSeconds: number,
  ) {
    super(message);
    this.name = "LeagueCreationLimitError";
  }
}

const positiveInteger = (value: number, name: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
};

export const normalizeLeagueCreationLimits = (
  limits: LeagueCreationLimits = defaultLeagueCreationLimits,
): LeagueCreationLimits => ({
  maxActiveLeaguesPerAccount: positiveInteger(
    limits.maxActiveLeaguesPerAccount,
    "maxActiveLeaguesPerAccount",
  ),
  maxCreatedLeaguesPerWindow: positiveInteger(
    limits.maxCreatedLeaguesPerWindow,
    "maxCreatedLeaguesPerWindow",
  ),
  creationWindowMs: positiveInteger(limits.creationWindowMs, "creationWindowMs"),
});

export const assertLeagueCreationAllowed = ({
  records,
  createdByUserId,
  now,
  limits,
}: {
  records: readonly LeagueCreationRecord[];
  createdByUserId: string;
  now: Date;
  limits: LeagueCreationLimits;
}): void => {
  const accountRecords = records.filter(record => record.createdByUserId === createdByUserId);
  if (accountRecords.length >= limits.maxActiveLeaguesPerAccount) {
    throw new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    );
  }

  const windowStartedAt = now.getTime() - limits.creationWindowMs;
  const recentRecords = accountRecords
    .filter(record => record.createdAt.getTime() >= windowStartedAt)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  if (recentRecords.length < limits.maxCreatedLeaguesPerWindow) return;

  const oldestRecentRecord = recentRecords[0];
  const retryAfterSeconds = oldestRecentRecord === undefined
    ? Math.ceil(limits.creationWindowMs / 1_000)
    : Math.max(1, Math.ceil(
      (oldestRecentRecord.createdAt.getTime() + limits.creationWindowMs - now.getTime()) / 1_000,
    ));
  throw new LeagueCreationLimitError(
    "league_creation_rate_limited",
    "Too many leagues were created recently. Try again later.",
    retryAfterSeconds,
  );
};

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

export interface JoinLeagueSeasonTeamRepositoryInput extends ClaimLeagueSeasonTeamRepositoryInput {
  role: PlatformLeagueMembership["role"];
  invitationTokenHash?: string;
}

export interface LeagueSetupRepository {
  registerLeagueSeason(input: RegisterLeagueSeasonRepositoryInput): MaybePromise<LeagueSeason>;
  claimLeagueSeasonTeam(input: ClaimLeagueSeasonTeamRepositoryInput): MaybePromise<PlatformLeagueMembership | null>;
  joinLeagueSeasonTeam(input: JoinLeagueSeasonTeamRepositoryInput): MaybePromise<PlatformLeagueMembership | null>;
  findLeagueSeason(seasonId: string): MaybePromise<LeagueSeason | null>;
  hasLeagueSeasonForLeague(leagueId: string): MaybePromise<boolean>;
  findLeagueSeasonForLeagueYear(leagueId: string, seasonYear: number): MaybePromise<LeagueSeason | null>;
  findMembership(userId: string, leagueId: string): MaybePromise<PlatformLeagueMembership | null>;
  membershipsForLeague(leagueId: string): MaybePromise<readonly PlatformLeagueMembership[]>;
}

export const membershipKeyFor = (userId: string, leagueId: string): string => `${userId}\0${leagueId}`;
