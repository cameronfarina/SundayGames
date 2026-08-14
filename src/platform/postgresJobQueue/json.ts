import type { JsonValue } from "../jobs.js";

const validatedJsonValue = (field: string, value: unknown): JsonValue => {
  if (
    value === null
    || typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(item => validatedJsonValue(field, item));
  }

  if (typeof value === "object") {
    const result: { [key: string]: JsonValue | undefined } = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = validatedJsonValue(field, entry);
    }
    return result;
  }

  throw new Error(`Postgres jobs row has invalid ${field}.`);
};

export const jsonValueFromDb = (
  field: string,
  value: unknown,
): JsonValue | undefined => {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value === "string"
    || typeof value === "number"
    || typeof value === "boolean"
  ) {
    return value;
  }

  try {
    const serialized = JSON.stringify(value);
    if (serialized === undefined) {
      throw new Error("JSON serialization returned no value.");
    }
    const parsed: unknown = JSON.parse(serialized);
    return validatedJsonValue(field, parsed);
  } catch {
    throw new Error(`Postgres jobs row has invalid ${field}.`);
  }
};

export const jsonbParameter = (value: unknown): string | null =>
  value === undefined ? null : JSON.stringify(value);
