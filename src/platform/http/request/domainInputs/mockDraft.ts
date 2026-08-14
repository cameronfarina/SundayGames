import type {
  MockDraftMetadataValue,
  MockDraftModeMetadata,
  MockDraftResultReference,
} from "../../../mockSessions.js";
import {
  isUnknownRecord,
  optionalNumber,
  optionalString,
  unknownRecord,
} from "../values.js";

export const mockDraftResultReferenceFor = (
  value: unknown,
): MockDraftResultReference | undefined => {
  const record = unknownRecord(value);
  const id = optionalString(record?.id);
  const kind = optionalString(record?.kind);
  if (id === undefined || (kind !== "mock-result" && kind !== "simulation-result")) {
    return undefined;
  }
  const label = optionalString(record?.label);
  return { id, kind, ...(label === undefined ? {} : { label }) };
};

const metadataValueFor = (value: unknown): MockDraftMetadataValue | undefined => {
  if (
    value === null
    || typeof value === "boolean"
    || typeof value === "number"
    || typeof value === "string"
  ) {
    return value;
  }
  if (Array.isArray(value)) {
    const entries = value.map(metadataValueFor);
    return entries.some(entry => entry === undefined)
      ? undefined
      : entries.filter(entry => entry !== undefined);
  }
  if (!isUnknownRecord(value)) return undefined;
  const result: Record<string, MockDraftMetadataValue> = {};
  for (const [key, entry] of Object.entries(value)) {
    const parsed = metadataValueFor(entry);
    if (parsed === undefined) return undefined;
    result[key] = parsed;
  }
  return result;
};

export const mockDraftModeMetadataFor = (value: unknown): MockDraftModeMetadata => {
  const record = unknownRecord(value) ?? {};
  const format = record.format === "snake" ? "snake" : "auction";
  const label = optionalString(record.label);
  const settings = metadataValueFor(record.settings);
  return {
    format,
    mockCount: optionalNumber(record.mockCount) ?? Number.NaN,
    ...(label === undefined ? {} : { label }),
    ...(settings === undefined || !isUnknownRecord(settings) ? {} : { settings }),
  };
};
