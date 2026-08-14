import { LeagueCreationError } from "./errors.js";

export type InputRecord = Record<string, unknown>;

export const recordValue = (value: unknown, label: string): InputRecord => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new LeagueCreationError(`${label} is invalid.`);
  }
  return Object.fromEntries(Object.entries(value));
};

export const stringField = (record: InputRecord, key: string, label: string): string => {
  const value = record[key];
  if (typeof value !== "string") throw new LeagueCreationError(`${label} is required.`);
  return value;
};

export const numberField = (record: InputRecord, key: string, label: string): number => {
  const value = record[key];
  if (typeof value !== "number") throw new LeagueCreationError(`${label} is required.`);
  return value;
};

export const stringArray = (value: unknown): string[] | null => {
  if (!Array.isArray(value) || value.some(item => typeof item !== "string")) return null;
  return value.flatMap(item => typeof item === "string" ? [item] : []);
};
