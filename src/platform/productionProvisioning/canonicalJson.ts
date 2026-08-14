import { createHash } from "node:crypto";
import { isJsonObject } from "./validation.js";

export const sha256 = (value: string): string => createHash("sha256").update(value).digest("hex");

export const canonicalJson = (value: unknown): string | undefined => {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isJsonObject(value)) {
    return `{${Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
};
