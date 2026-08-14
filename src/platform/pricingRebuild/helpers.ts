import type { Position } from "../../../config/league.js";
import { balancedScenarioId } from "./constants.js";

export const normalizePlayerName = (value: string): string => value
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, " ")
  .trim()
  .replace(/\s+/g, " ");

export const playerHistoryKey = (name: string, position: Position): string =>
  `${normalizePlayerName(name)}\0${position}`;

export const clampWholeDollars = (
  value: number,
  maximum = Number.POSITIVE_INFINITY,
): number => !Number.isFinite(value)
  ? 0
  : Math.min(maximum, Math.max(0, Math.round(value)));

export const average = (values: readonly number[]): number | undefined =>
  values.length === 0
    ? undefined
    : values.reduce((total, value) => total + value, 0) / values.length;

export const normalizedScenarioIds = (
  scenarioIds: readonly string[],
): readonly string[] => {
  const normalized = scenarioIds
    .map(scenarioId => scenarioId.trim())
    .filter(scenarioId => scenarioId.length > 0);
  const unique = [...new Set(normalized)];
  return unique.length > 0 ? unique : [balancedScenarioId];
};

export const addMapValue = <Key>(
  map: Map<Key, number[]>,
  key: Key,
  value: number,
): void => {
  const values = map.get(key);
  if (values === undefined) map.set(key, [value]);
  else values.push(value);
};

export const isPositiveInteger = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value > 0;

export const isNonNegativeInteger = (value: number | undefined): value is number =>
  value !== undefined && Number.isInteger(value) && value >= 0;
