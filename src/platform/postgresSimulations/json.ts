export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const jsonValueFromDb = (value: unknown): unknown => {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) return value;

  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Postgres simulation row contains invalid JSON.");
  }
  const parsed: unknown = JSON.parse(serialized);
  return parsed;
};

export const jsonbParameter = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error("Simulation data cannot be serialized as JSON.");
  }
  return serialized;
};

export const stringFromRecord = (
  record: Record<string, unknown>,
  field: string,
  fallback: string,
): string => typeof record[field] === "string" ? record[field] : fallback;

export const numberFromRecord = (
  record: Record<string, unknown>,
  field: string,
  fallback: number,
): number => typeof record[field] === "number" ? record[field] : fallback;
