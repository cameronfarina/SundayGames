import { positions, type Position } from "../../../config/league.js";
import { invalidWorkerMessage } from "./errors.js";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) return invalidWorkerMessage();
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? value
    : invalidWorkerMessage();
};

export const stringValue = (value: unknown): string =>
  typeof value === "string" ? value : invalidWorkerMessage();

export const numberValue = (value: unknown): number =>
  typeof value === "number" ? value : invalidWorkerMessage();

export const dateValue = (value: unknown): Date => {
  if (value instanceof Date) return value;
  if (typeof value !== "string") return invalidWorkerMessage();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? invalidWorkerMessage() : date;
};

export const booleanValue = (value: unknown): boolean =>
  typeof value === "boolean" ? value : invalidWorkerMessage();

export const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : invalidWorkerMessage();

export const positionValue = (value: unknown): Position =>
  positions.find(position => position === value) ?? invalidWorkerMessage();

export const optionalStringValue = (value: unknown): string | undefined =>
  value === undefined ? undefined : stringValue(value);

export const optionalNumberValue = (value: unknown): number | undefined =>
  value === undefined ? undefined : numberValue(value);

export const numberRecordValue = (value: unknown): Readonly<Record<string, number>> =>
  Object.fromEntries(
    Object.entries(recordValue(value)).map(([key, child]) => [key, numberValue(child)]),
  );

export const optionalNumberRecord = (
  value: unknown,
): Readonly<Record<string, number>> | undefined => {
  if (value === undefined) return undefined;
  return numberRecordValue(value);
};
