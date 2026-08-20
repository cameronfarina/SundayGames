import type { PostgresQueryResult } from "../../../src/platform/postgresPlatformStore.js";

export const fakeAuthRateLimitQuery = (
  normalizedSql: string,
): PostgresQueryResult<unknown> | undefined => {
  if (normalizedSql.startsWith("SELECT attempt_count, reset_at FROM auth_rate_limit_windows")) {
    return { rows: [] };
  }
  if (normalizedSql.startsWith("SELECT COUNT(*) AS tracked_count")) {
    return { rows: [{ tracked_count: "0", earliest_reset_at: null }] };
  }
  if (
    normalizedSql.includes("auth_rate_limit_windows") &&
    (
      normalizedSql.startsWith("DELETE") ||
      normalizedSql.startsWith("INSERT") ||
      normalizedSql.startsWith("UPDATE")
    )
  ) {
    return { rows: [], rowCount: 1 };
  }
  return undefined;
};
