import type { Position } from "../../../../config/league.js";

export const invalidStoredSetup = (path: string): never => {
  throw new Error(`Stored live draft setup field ${path} is invalid.`);
};

export const recordValue = (value: unknown, path: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return invalidStoredSetup(path);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) result[key] = child;
  return result;
};

export const stringValue = (value: unknown, path: string): string =>
  typeof value === "string" ? value : invalidStoredSetup(path);

export const numberValue = (value: unknown, path: string): number =>
  typeof value === "number" && Number.isFinite(value) ? value : invalidStoredSetup(path);

export const dateValue = (value: unknown, path: string): Date => {
  const date = value instanceof Date ? new Date(value) : new Date(stringValue(value, path));
  return Number.isNaN(date.getTime()) ? invalidStoredSetup(path) : date;
};

export const positionValue = (value: unknown, path: string): Position => {
  switch (value) {
    case "QB": return "QB";
    case "RB": return "RB";
    case "WR": return "WR";
    case "TE": return "TE";
    case "K": return "K";
    case "DST": return "DST";
    default: return invalidStoredSetup(path);
  }
};

export const optionalValue = <T>(
  value: unknown,
  path: string,
  decode: (candidate: unknown, candidatePath: string) => T,
): T | undefined => value === undefined || value === null ? undefined : decode(value, path);

export const arrayValue = <T>(
  value: unknown,
  path: string,
  decode: (candidate: unknown, candidatePath: string) => T,
): T[] => {
  if (!Array.isArray(value)) return invalidStoredSetup(path);
  return value.map((candidate, index) => decode(candidate, `${path}[${index}]`));
};
