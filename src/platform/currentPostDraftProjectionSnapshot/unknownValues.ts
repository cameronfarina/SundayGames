export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const recordFrom = (value: unknown): Record<string, unknown> | undefined =>
  isRecord(value) ? value : undefined;

export const arrayFrom = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

export const finiteNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;
