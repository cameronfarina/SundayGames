import type { JsonValue } from "../../jobs.js";
import { invalidSnapshot, recordValue } from "./primitives.js";

export const jsonValue = (value: unknown, path: string): JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : invalidSnapshot(path);
  }
  if (Array.isArray(value)) {
    return value.map((item, index) => jsonValue(item, `${path}[${index}]`));
  }
  const source = recordValue(value, path);
  const result: Record<string, JsonValue> = {};
  for (const [key, child] of Object.entries(source)) {
    if (child !== undefined) result[key] = jsonValue(child, `${path}.${key}`);
  }
  return result;
};
