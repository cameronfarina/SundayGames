import type {
  ParsedOptionValue,
  PlatformE2eEnv,
  PlatformE2eTarget,
} from "./contracts.js";
import { optionalEnvFrom } from "./environment.js";

export const optionValue = (
  args: readonly string[],
  index: number,
  option: string,
): ParsedOptionValue | null => {
  const argument = args[index];
  if (argument === undefined) return null;
  const inlinePrefix = `${option}=`;
  if (argument.startsWith(inlinePrefix)) {
    return { value: argument.slice(inlinePrefix.length), nextIndex: index };
  }
  if (argument !== option) return null;
  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${option} requires a value.`);
  }
  return { value, nextIndex: index + 1 };
};

export const targetValue = (
  value: string | undefined,
  source: string,
): PlatformE2eTarget | undefined => {
  if (value === undefined) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "local" || normalized === "deployed") return normalized;
  throw new Error(`${source} must be local or deployed.`);
};

export const positiveIntegerValue = (value: string, source: string): number => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${source} must be a positive integer.`);
  }
  return parsed;
};

export const positiveIntegerEnv = (
  env: PlatformE2eEnv,
  key: string,
  fallback: number,
): number => {
  const value = optionalEnvFrom(env, key);
  return value === undefined ? fallback : positiveIntegerValue(value, key);
};

export const normalizeBaseUrl = (value: string, source: string): string => {
  const trimmedValue = value.trim();
  if (trimmedValue.length === 0) throw new Error(`${source} cannot be empty.`);
  let url: URL;
  try {
    url = new URL(trimmedValue);
  } catch {
    throw new Error(`${source} must be a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`${source} must use http or https.`);
  }
  if (url.search.length > 0 || url.hash.length > 0) {
    throw new Error(`${source} must not include a query string or hash.`);
  }
  return url.toString().replace(/\/$/u, "");
};

export const normalizeSmokeRunId = (value: string, source: string): string => {
  const normalized = value.trim().toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "");
  if (normalized.length === 0) {
    throw new Error(`${source} must contain at least one letter or number.`);
  }
  return normalized;
};
