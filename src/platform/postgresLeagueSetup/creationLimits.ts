import {
  LeagueCreationLimitError,
  type LeagueCreationLimits,
} from "../leagueSetup.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { firstRow } from "./databaseValues.js";
import type { LeagueCreationCountRow } from "./rows.js";

export const assertLeagueCreationAllowed = async (
  client: PostgresQueryClient,
  limits: LeagueCreationLimits,
  createdByUserId: string,
  now: Date,
): Promise<void> => {
  const windowStartedAt = new Date(now.getTime() - limits.creationWindowMs);
  const result = await client.query<LeagueCreationCountRow>(`
SELECT
  COUNT(*) FILTER (WHERE archived_at IS NULL)::integer AS active_league_count,
  COUNT(*) FILTER (WHERE created_at >= $2)::integer AS recent_league_count,
  MIN(created_at) FILTER (WHERE created_at >= $2) AS oldest_recent_created_at
FROM leagues
WHERE created_by_user_id = $1;
`.trim(), [createdByUserId, windowStartedAt]);
  const counts = firstRow(result) ?? {
    active_league_count: 0,
    recent_league_count: 0,
    oldest_recent_created_at: null,
  };
  if (Number(counts.active_league_count) >= limits.maxActiveLeaguesPerAccount) {
    throw new LeagueCreationLimitError(
      "active_league_quota_reached",
      "This account has reached its league limit.",
      0,
    );
  }
  if (Number(counts.recent_league_count) < limits.maxCreatedLeaguesPerWindow) return;

  const oldestCreatedAt = counts.oldest_recent_created_at instanceof Date
    ? counts.oldest_recent_created_at
    : new Date(String(counts.oldest_recent_created_at));
  const retryAfterSeconds = Number.isNaN(oldestCreatedAt.getTime())
    ? Math.ceil(limits.creationWindowMs / 1_000)
    : Math.max(1, Math.ceil(
      (oldestCreatedAt.getTime() + limits.creationWindowMs - now.getTime()) / 1_000,
    ));
  throw new LeagueCreationLimitError(
    "league_creation_rate_limited",
    "Too many leagues were created recently. Try again later.",
    retryAfterSeconds,
  );
};
