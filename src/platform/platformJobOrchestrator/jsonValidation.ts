import type { JsonObject, JsonValue } from "../jobs.js";

export const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isStringArray = (value: JsonValue | undefined): value is readonly string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

export const isOptionalString = (value: JsonValue | undefined): value is string | undefined =>
  value === undefined || typeof value === "string";

export const isOptionalBoolean = (value: JsonValue | undefined): value is boolean | undefined =>
  value === undefined || typeof value === "boolean";

export const isOptionalJsonObject = (
  value: JsonValue | undefined,
): value is JsonObject | undefined => value === undefined || isJsonObject(value);

export const isPositiveInteger = (value: JsonValue | undefined): value is number =>
  typeof value === "number" && Number.isInteger(value) && value > 0;

export const isNonNegativeInteger = (value: JsonValue | undefined): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;
