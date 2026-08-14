import { createHash } from "node:crypto";
import type {
  JsonSnapshotValue,
  PricingInputSnapshot,
} from "./contracts.js";

type NormalizedSnapshotValue = JsonSnapshotValue | undefined;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (!isRecord(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const normalizeSnapshotValue = (value: unknown): NormalizedSnapshotValue => {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError("Pricing snapshot inputs must contain only finite numbers.");
    }
    return value;
  }
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value.map(item => normalizeSnapshotValue(item) ?? null);
  }
  if (!isPlainRecord(value)) {
    throw new TypeError("Pricing snapshot inputs must be plain JSON-compatible values.");
  }

  const normalized: Record<string, JsonSnapshotValue> = {};
  for (const key of Object.keys(value).sort()) {
    const childValue = normalizeSnapshotValue(value[key]);
    if (childValue !== undefined) normalized[key] = childValue;
  }
  return normalized;
};

const canonicalSnapshotString = (value: unknown): string =>
  JSON.stringify(normalizeSnapshotValue(value) ?? null);

export const hashPricingSnapshotInputs = (inputs: unknown): string =>
  createHash("sha256").update(canonicalSnapshotString(inputs)).digest("hex");

export const createPricingInputSnapshot = (
  inputs: unknown,
  id?: string,
): PricingInputSnapshot => {
  const hash = hashPricingSnapshotInputs(inputs);
  return { id: id ?? `input-snapshot:${hash}`, hash };
};
