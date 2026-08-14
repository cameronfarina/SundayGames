import type { AccountRecord } from "../../../src/platform/auth.js";
import type { PlatformHttpResponse } from "../../../src/platform/platformHttp.js";
import { expect } from "vitest";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const expectBodyRecord = (value: unknown): Record<string, unknown> => {
  if (!isRecord(value)) throw new Error("Expected response body record.");
  return value;
};

export const expectString = (value: unknown): string => {
  if (typeof value !== "string") throw new Error("Expected string response field.");
  return value;
};

export const expectNumber = (value: unknown): number => {
  if (typeof value !== "number") throw new Error("Expected numeric response field.");
  return value;
};

export const expectRecordArray = (value: unknown): readonly Record<string, unknown>[] => {
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error("Expected response record array.");
  }
  return value;
};

export const expectNumberRecord = (value: unknown): Readonly<Record<string, number>> => {
  if (!isRecord(value)) throw new Error("Expected numeric response record.");
  const numbers: Record<string, number> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "number") throw new Error("Expected numeric response record.");
    numbers[key] = item;
  }
  return numbers;
};

const isAsyncTextStream = (value: unknown): value is AsyncIterable<string> =>
  value !== null &&
  typeof value === "object" &&
  Symbol.asyncIterator in value &&
  typeof value[Symbol.asyncIterator] === "function";

export const expectAsyncTextStream = (value: unknown): AsyncIterable<string> => {
  if (!isAsyncTextStream(value)) {
    throw new Error("Expected asynchronous text stream response body.");
  }
  return value;
};

export const expectAccount = (value: unknown): AccountRecord => {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.email !== "string" ||
    !(value.createdAt instanceof Date) ||
    !(value.updatedAt instanceof Date)
  ) {
    throw new Error("Expected account response field.");
  }
  return {
    id: value.id,
    email: value.email,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};

export const sessionTokenFrom = (response: PlatformHttpResponse): string => {
  const setCookie = response.headers?.["Set-Cookie"];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const match = cookie?.match(/(?:^|;\s*)mockd_session=([^;]+)/);
  if (match?.[1] === undefined) throw new Error("Expected a Mockd session cookie.");
  return decodeURIComponent(match[1]);
};

const browserPayloadDenylist = new Set([
  "actorUserId",
  "commissionerUserId",
  "idempotencyKey",
  "mutationHash",
  "passwordHash",
  "sessionToken",
  "tokenHash",
  "viewerPasswordHashRef",
]);

export const expectPublicBrowserPayload = (value: unknown): void => {
  const visit = (candidate: unknown): void => {
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!isRecord(candidate)) return;
    for (const [key, nestedValue] of Object.entries(candidate)) {
      expect(browserPayloadDenylist, `Browser payload exposed ${key}.`).not.toContain(key);
      visit(nestedValue);
    }
  };
  visit(value);
};
