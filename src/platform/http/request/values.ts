export const isUnknownRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const unknownRecord = (value: unknown): Record<string, unknown> | null =>
  isUnknownRecord(value) ? value : null;

export const bodyRecord = (value: unknown): Record<string, unknown> =>
  unknownRecord(value) ?? {};

export const stringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";
  return String(value);
};

export const optionalString = (value: unknown): string | undefined => {
  const text = typeof value === "string" ? value : undefined;
  return text === undefined || text.length === 0 ? undefined : text;
};

export const optionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  return undefined;
};

export const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;
  return undefined;
};

export const dateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

export const requestDate = (
  body: Record<string, unknown>,
  query: Record<string, unknown>,
  key: string,
): Date | undefined => dateValue(body[key] ?? query[key]);

export const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

export const stringArrayValue = (value: unknown): readonly string[] =>
  arrayValue(value).map(stringValue);

export const headerValue = (
  headers: Record<string, string | undefined> | undefined,
  headerName: string,
): string | undefined => {
  const target = headerName.toLowerCase();
  return Object.entries(headers ?? {})
    .find(([candidate]) => candidate.toLowerCase() === target)?.[1];
};
