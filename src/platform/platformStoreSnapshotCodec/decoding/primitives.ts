export const invalidSnapshot = (path: string): never => {
  throw new Error(`Invalid platform store snapshot at ${path}.`);
};

export const recordValue = (value: unknown, path: string): Record<string, unknown> => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return invalidSnapshot(path);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return invalidSnapshot(path);
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value)) result[key] = child;
  return result;
};

export const stringValue = (value: unknown, path: string): string =>
  typeof value === "string" ? value : invalidSnapshot(path);

export const numberValue = (value: unknown, path: string): number =>
  typeof value === "number" && Number.isFinite(value) ? value : invalidSnapshot(path);

export const integerValue = (value: unknown, path: string): number => {
  const result = numberValue(value, path);
  return Number.isSafeInteger(result) ? result : invalidSnapshot(path);
};

export const booleanValue = (value: unknown, path: string): boolean =>
  typeof value === "boolean" ? value : invalidSnapshot(path);

export const dateValue = (value: unknown, path: string): Date => {
  const result = value instanceof Date ? new Date(value) : new Date(stringValue(value, path));
  return Number.isNaN(result.getTime()) ? invalidSnapshot(path) : result;
};

export const optionalValue = <T>(
  value: unknown,
  path: string,
  decode: (candidate: unknown, candidatePath: string) => T,
): T | undefined => value === undefined || value === null ? undefined : decode(value, path);

export const arrayValue = <T>(
  value: unknown,
  path: string,
  decode: (candidate: unknown, candidatePath: string) => T,
): T[] => {
  if (!Array.isArray(value)) return invalidSnapshot(path);
  return value.map((candidate, index) => decode(candidate, `${path}[${index}]`));
};

export const optionalArrayValue = <T>(
  value: unknown,
  path: string,
  decode: (candidate: unknown, candidatePath: string) => T,
): T[] => value === undefined || value === null ? [] : arrayValue(value, path, decode);

export const stringArrayValue = (value: unknown, path: string): string[] =>
  arrayValue(value, path, stringValue);

export const numericRecordValue = (value: unknown, path: string): Record<string, number> => {
  const source = recordValue(value, path);
  const result: Record<string, number> = {};
  for (const [key, child] of Object.entries(source)) {
    result[key] = numberValue(child, `${path}.${key}`);
  }
  return result;
};
