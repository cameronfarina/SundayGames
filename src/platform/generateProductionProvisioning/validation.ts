export type JsonObject = Record<string, unknown>;

export const fail = (path: string, message: string): never => {
  throw new Error(`Invalid production owner/account mapping at ${path}: ${message}`);
};

const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const objectAt = (value: unknown, path: string): JsonObject => {
  if (!isJsonObject(value)) return fail(path, "expected an object.");
  return value;
};

export const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(path, "expected a non-empty string.");
  }
  return value.trim();
};

export const assertOnlyFields = (
  value: JsonObject,
  expectedFields: readonly string[],
  path: string,
): void => {
  const unexpectedFields = Object.keys(value).filter(field => !expectedFields.includes(field));
  if (unexpectedFields.length > 0) {
    fail(path, `unexpected field${unexpectedFields.length === 1 ? "" : "s"} ${unexpectedFields.join(", ")}.`);
  }
};
