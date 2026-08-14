import type { LeagueSyncEnv } from "./contracts.js";

export const yahooRequiredEnv: readonly string[] = [
  "MOCKD_YAHOO_CLIENT_ID",
  "MOCKD_YAHOO_CLIENT_SECRET",
];

export const espnRequiredEnv: readonly string[] = [
  "MOCKD_ESPN_LEAGUE_ID",
  "MOCKD_ESPN_SWID",
  "MOCKD_ESPN_S2",
];

const hasEnvValue = (env: LeagueSyncEnv, key: string): boolean => Boolean(env[key]?.trim());

export const allConfigured = (env: LeagueSyncEnv, keys: readonly string[]): boolean =>
  keys.every(key => hasEnvValue(env, key));
