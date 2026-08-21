import type {
  AccountOnboardingIntent,
  AccountOnboardingProvider,
  AccountOnboardingRecord,
} from "../../accountOnboarding.js";
import { invalidSnapshot, recordValue } from "./primitives.js";

const intentValue = (value: unknown, path: string): AccountOnboardingIntent | null => {
  if (value === null) return null;
  if (value === "practice" || value === "live_draft") return value;
  return invalidSnapshot(path);
};

const providerValue = (value: unknown, path: string): AccountOnboardingProvider => {
  if (value === "espn" || value === "sleeper" || value === "yahoo"
    || value === "other" || value === "none") return value;
  return invalidSnapshot(path);
};

const dateValue = (value: unknown, path: string): Date => {
  if (typeof value !== "string" && !(value instanceof Date)) return invalidSnapshot(path);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? invalidSnapshot(path) : parsed;
};

export const accountOnboardingValue = (value: unknown, path: string): AccountOnboardingRecord => {
  const record = recordValue(value, path);
  if (typeof record.accountId !== "string") return invalidSnapshot(`${path}.accountId`);
  if (record.intentBoth !== undefined && typeof record.intentBoth !== "boolean") {
    return invalidSnapshot(`${path}.intentBoth`);
  }
  if (record.providers !== null && !Array.isArray(record.providers)) {
    return invalidSnapshot(`${path}.providers`);
  }
  const intent = intentValue(record.intent, `${path}.intent`);
  if (record.intentBoth === true && intent !== "live_draft") {
    return invalidSnapshot(`${path}.intentBoth`);
  }
  return {
    accountId: record.accountId,
    intent,
    ...(record.intentBoth === undefined ? {} : { intentBoth: record.intentBoth }),
    providers: record.providers === null
      ? null
      : record.providers.map((provider, index) =>
        providerValue(provider, `${path}.providers[${index}]`)),
    completedAt: record.completedAt === null
      ? null
      : dateValue(record.completedAt, `${path}.completedAt`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
  };
};
