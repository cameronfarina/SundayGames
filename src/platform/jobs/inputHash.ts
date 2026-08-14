import { createHash } from "node:crypto";
import type { JsonValue } from "./contracts.js";

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) =>
    leftKey.localeCompare(rightKey),
  );
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);

  return `{${serializedEntries.join(",")}}`;
};

export const hashJobInput = (inputJson: JsonValue): string =>
  createHash("sha256").update(stableStringify(inputJson)).digest("base64url");
