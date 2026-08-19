export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const recordValue = (value: unknown): Record<string, unknown> =>
  isRecord(value) ? value : {};

export const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

export const recordArray = (value: unknown): readonly Record<string, unknown>[] =>
  arrayValue(value).filter(isRecord);

export const textValue = (value: unknown): string => {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
};

export const optionalText = (value: unknown): string | undefined => {
  const text = textValue(value);
  return text.length === 0 ? undefined : text;
};

export const numberValue = (value: unknown, fallback = 0): number => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
};

export const optionalNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return undefined;
};

export const stringArray = (value: unknown): readonly string[] =>
  arrayValue(value).map(textValue).filter(entry => entry.length > 0);

/** Sleeper and ESPN both report points as loose floats; keep two decimals. */
export const pointsValue = (value: unknown): number =>
  Math.round(numberValue(value) * 100) / 100;

export const numberMap = (value: unknown): Record<string, number> => {
  const numbers: Record<string, number> = {};
  for (const [key, entry] of Object.entries(recordValue(value))) {
    const parsed = optionalNumber(entry);
    if (parsed !== undefined) numbers[key] = parsed;
  }
  return numbers;
};
