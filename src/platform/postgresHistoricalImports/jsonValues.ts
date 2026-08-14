export const jsonValueFromDb = (value: unknown): unknown => {
  if (typeof value !== "string") return structuredClone(value);
  return JSON.parse(value);
};

export const jsonObjectFromDb = (value: unknown): Record<string, unknown> => {
  if (value === undefined || value === null) return {};
  const parsed: unknown = jsonValueFromDb(value);
  return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
    ? Object.fromEntries(Object.entries(parsed))
    : {};
};

export const jsonArrayFromDb = (value: unknown): readonly unknown[] => {
  const parsed: unknown = jsonValueFromDb(value);
  return Array.isArray(parsed) ? structuredClone(parsed) : [];
};

export const jsonbParameter = (value: unknown): string => JSON.stringify(value);
