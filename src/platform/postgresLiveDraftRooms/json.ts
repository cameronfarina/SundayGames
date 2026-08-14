import type { PostgresQueryResult } from "../postgresPlatformStore.js";

const malformedPayloadMessage = "Postgres draft room event payload was malformed.";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];

export const jsonbParameter = (value: unknown): string => JSON.stringify(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error(malformedPayloadMessage);
  return value;
};

export const stringValue = (value: unknown): string => {
  if (typeof value !== "string") throw new Error(malformedPayloadMessage);
  return value;
};

export const numberValue = (value: unknown): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(malformedPayloadMessage);
  }
  return value;
};

export const optionalStringValue = (value: unknown): string | undefined =>
  value === undefined ? undefined : stringValue(value);

export const optionalNumberValue = (value: unknown): number | undefined =>
  value === undefined ? undefined : numberValue(value);

export const arrayValue = (value: unknown): readonly unknown[] => {
  if (!Array.isArray(value)) throw new Error(malformedPayloadMessage);
  return value;
};
