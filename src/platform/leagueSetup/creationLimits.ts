import type { LeagueCreationLimits, LeagueCreationRecord } from "./contracts.js";

export const defaultLeagueCreationLimits: LeagueCreationLimits = {
  maxActiveLeaguesPerAccount: 20,
  maxCreatedLeaguesPerWindow: 5,
  creationWindowMs: 60 * 60 * 1_000,
};

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
  enforceRateLimit = true,
}: {
  records: readonly LeagueCreationRecord[];
  createdByUserId: string;
  now: Date;
  limits: LeagueCreationLimits;
  enforceRateLimit?: boolean;
}): void => {
  const accountRecords = records.filter(record => record.createdByUserId === createdByUserId);
  const activeRecords = accountRecords.filter(record => record.archivedAt === undefined);
  if (activeRecords.length >= limits.maxActiveLeaguesPerAccount) {
    throw new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    );
  }

  if (!enforceRateLimit) return;

  const windowStartedAt = now.getTime() - limits.creationWindowMs;
  const recentRecords = accountRecords
    .filter(record => record.createdAt.getTime() >= windowStartedAt)
    .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  if (recentRecords.length < limits.maxCreatedLeaguesPerWindow) return;

  const retryAfterSeconds = recentRecords.reduce((lowestRetry, record) => Math.min(
    lowestRetry,
    Math.max(1, Math.ceil(
      (record.createdAt.getTime() + limits.creationWindowMs - now.getTime()) / 1_000,
    )),
  ), Math.ceil(limits.creationWindowMs / 1_000));
  throw new LeagueCreationLimitError(
    "league_creation_rate_limited",
    "Too many leagues were created recently. Try again later.",
    retryAfterSeconds,
  );
};
