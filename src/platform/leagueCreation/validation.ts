import { LeagueCreationError } from "./errors.js";

export const requiredText = (value: string, label: string): string => {
  const normalized = value.trim();
  if (normalized.length === 0) throw new LeagueCreationError(`${label} is required.`);
  return normalized;
};

export const positiveInteger = (value: number, label: string): number => {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new LeagueCreationError(`${label} must be a positive whole number.`);
  }
  return value;
};
