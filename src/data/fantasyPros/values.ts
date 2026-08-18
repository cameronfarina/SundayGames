export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const textValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

export const optionalText = (value: unknown): string | undefined => {
  const text = textValue(value);
  return text.length === 0 ? undefined : text;
};

// FantasyPros returns the same field as a number in one endpoint and a quoted
// string in another, so every numeric read goes through one coercion.
export const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = textValue(value);
  if (text.length === 0) return undefined;
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const optionalInteger = (value: unknown): number | undefined => {
  const parsed = optionalNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
};

export const recordArray = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

export const textArray = (value: unknown): readonly string[] =>
  Array.isArray(value)
    ? value.flatMap(entry => {
      const text = textValue(entry);
      return text.length === 0 ? [] : [text];
    })
    : [];
