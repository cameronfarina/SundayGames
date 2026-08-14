export type JsonObject = Record<string, unknown>;

export const fail = (path: string, message: string): never => {
  throw new Error(`Invalid production provisioning document at ${path}: ${message}`);
};

export const isJsonObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const objectAt = (value: unknown, path: string): JsonObject => {
  if (!isJsonObject(value)) return fail(path, "expected an object.");
  return value;
};

export const arrayAt = (value: unknown, path: string): readonly unknown[] => {
  if (!Array.isArray(value)) return fail(path, "expected an array.");
  return value;
};

export const stringAt = (value: unknown, path: string): string => {
  if (typeof value !== "string" || value.trim().length === 0) {
    return fail(path, "expected a non-empty string.");
  }
  return value.trim();
};

export const optionalStringAt = (value: unknown, path: string): string | undefined =>
  value === undefined ? undefined : stringAt(value, path);

const numberAt = (value: unknown, path: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(path, "expected a finite number.");
  }
  return value;
};

export const nonNegativeNumberAt = (value: unknown, path: string): number => {
  const parsed = numberAt(value, path);
  if (parsed < 0) return fail(path, "expected a number greater than or equal to 0.");
  return parsed;
};

export const positiveNumberAt = (value: unknown, path: string): number => {
  const parsed = numberAt(value, path);
  if (parsed <= 0) return fail(path, "expected a number greater than 0.");
  return parsed;
};

export const integerAt = (value: unknown, path: string, minimum = 0): number => {
  const parsed = numberAt(value, path);
  if (!Number.isInteger(parsed) || parsed < minimum) {
    return fail(path, `expected an integer greater than or equal to ${minimum}.`);
  }
  return parsed;
};

export const optionalIntegerAt = (
  value: unknown,
  path: string,
  minimum = 0,
): number | undefined => value === undefined ? undefined : integerAt(value, path, minimum);

export const enumAt = <TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  path: string,
): TValue => {
  const parsed = stringAt(value, path);
  const match = allowed.find(candidate => candidate === parsed);
  if (match === undefined) return fail(path, `expected one of ${allowed.join(", ")}.`);
  return match;
};

export const uniqueBy = <TValue>(
  values: readonly TValue[],
  keyFor: (value: TValue) => string,
  path: string,
): void => {
  const seen = new Set<string>();
  for (const value of values) {
    const key = keyFor(value);
    if (seen.has(key)) fail(path, `contains duplicate value "${key}".`);
    seen.add(key);
  }
};
