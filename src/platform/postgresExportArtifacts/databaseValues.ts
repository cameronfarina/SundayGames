import type { PostgresQueryResult } from "../postgresPlatformStore.js";

export const firstRow = <TRow>(result: PostgresQueryResult<TRow>): TRow | undefined =>
  result.rows[0];

export const jsonbParameter = (value: unknown): string => JSON.stringify(value);

export const dateFromDb = (value: Date | string): Date =>
  value instanceof Date ? new Date(value.getTime()) : new Date(value);
