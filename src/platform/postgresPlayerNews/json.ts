const jsonValueFromDb = (value: unknown): unknown => (typeof value !== "string" ? value : JSON.parse(value));

export const jsonStringArrayFromDb = (value: unknown): string[] => {
  const parsed = jsonValueFromDb(value);
  return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
};
