export type JsonObject = Record<string, unknown>;

export const objectValue = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(Object.entries(value))
    : null;

export const finiteNumber = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const positiveInteger = (value: unknown): number | null => {
  const number = finiteNumber(value);
  return number !== null && Number.isSafeInteger(number) && number > 0 ? number : null;
};

export const normalizedString = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

export const requiredObject = (value: unknown, path: string): JsonObject => {
  const object = objectValue(value);
  if (object === null) throw new Error(`ESPN response is missing ${path}.`);
  return object;
};

export const requiredNumber = (value: unknown, path: string): number => {
  const number = finiteNumber(value);
  if (number === null) throw new Error(`ESPN response is missing ${path}.`);
  return number;
};

export const optionalPositiveInteger = (value: unknown, path: string): number | null => {
  if (value === undefined || value === null) return null;
  const number = positiveInteger(value);
  if (number === null) throw new Error(`ESPN response has an invalid ${path}.`);
  return number;
};
