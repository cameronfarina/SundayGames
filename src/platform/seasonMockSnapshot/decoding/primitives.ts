import { positions, type Position } from "../../../../config/league.js";
import { malformedSnapshot } from "../errors.js";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const plainRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return malformedSnapshot();
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value
    : malformedSnapshot();
};

export const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : malformedSnapshot();

export const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : malformedSnapshot();

export const nonEmptyString = (value: unknown): string => {
  const result = stringValue(value).trim();
  return result.length > 0 ? result : malformedSnapshot();
};

export const optionalString = (value: unknown): string | undefined =>
  value === undefined ? undefined : stringValue(value);

export const optionalStringArray = (value: unknown): string[] | undefined =>
  value === undefined ? undefined : arrayValue(value).map(stringValue);

export const finiteNumber = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : malformedSnapshot();

export const nonNegativeInteger = (value: unknown): number => {
  const result = finiteNumber(value);
  return Number.isInteger(result) && result >= 0 ? result : malformedSnapshot();
};

export const positiveInteger = (value: unknown): number => {
  const result = finiteNumber(value);
  return Number.isInteger(result) && result > 0 ? result : malformedSnapshot();
};

export const optionalFiniteNumber = (value: unknown): number | undefined =>
  value === undefined ? undefined : finiteNumber(value);

export const dateString = (value: unknown): string => {
  const date = value instanceof Date ? value : new Date(stringValue(value));
  return Number.isNaN(date.getTime()) ? malformedSnapshot() : date.toISOString();
};

export const positionValue = (value: unknown): Position => {
  if (typeof value !== "string") return malformedSnapshot();
  return positions.find(candidate => candidate === value) ?? malformedSnapshot();
};

export const numberRecord = (
  value: unknown,
  integerOnly: boolean,
): Record<string, number> => {
  const record = plainRecord(value);
  return Object.fromEntries(Object.entries(record).map(([key, childValue]) => [
    nonEmptyString(key),
    integerOnly ? nonNegativeInteger(childValue) : finiteNumber(childValue),
  ]));
};
