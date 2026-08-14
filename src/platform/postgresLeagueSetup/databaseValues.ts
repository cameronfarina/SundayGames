import type {
  LeagueProvider,
  LeagueSeasonSetupStatus,
} from "../leagueSeason.js";
import type { PostgresQueryResult } from "../postgresPlatformStore.js";
import type { WorkspaceRole } from "../workspacePrivacy.js";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];

export const jsonbParameter = (value: unknown): string => JSON.stringify(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const jsonObjectFromDb = (value: unknown): Record<string, unknown> => {
  if (isRecord(value)) return structuredClone(value);
  if (typeof value !== "string") return {};

  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
};

export const stringArrayFromDb = (value: unknown): string[] => {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return [];
    }
  }

  return Array.isArray(parsed)
    ? parsed.filter((candidate): candidate is string => typeof candidate === "string")
    : [];
};

export const providerFromDb = (value: string | null): LeagueProvider => {
  if (value === "espn" || value === "sleeper" || value === "yahoo" || value === "mockd") {
    return value;
  }
  return "mockd";
};

export const statusFromDb = (value: string): LeagueSeasonSetupStatus =>
  value === "published" || value === "locked" ? value : "draft";

export const workspaceRoleFromDb = (value: string): WorkspaceRole => {
  if (value === "owner" || value === "admin" || value === "observer") return value;
  return "member";
};

export const numberFromObject = (
  record: Record<string, unknown>,
  key: string,
  fallback: number,
): number => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
};

export const stringFromObject = (
  record: Record<string, unknown>,
  key: string,
): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
};
