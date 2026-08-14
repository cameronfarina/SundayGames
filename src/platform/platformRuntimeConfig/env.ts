import type { PlatformRuntimeEnv } from "./contracts.js";

export const optionalEnvString = (
  env: PlatformRuntimeEnv,
  key: string,
): string | undefined => {
  const value = env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

export const positiveIntegerEnv = (
  env: PlatformRuntimeEnv,
  key: string,
  fallback: number,
): number => {
  const value = optionalEnvString(env, key);
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${key} must be a positive integer.`);
  }
  return parsed;
};

export const optionalPositiveIntegerEnv = (
  env: PlatformRuntimeEnv,
  key: string,
): number | undefined => optionalEnvString(env, key) === undefined
  ? undefined
  : positiveIntegerEnv(env, key, 1);

export const booleanEnv = (
  env: PlatformRuntimeEnv,
  key: string,
  fallback = false,
): boolean => {
  const value = optionalEnvString(env, key);
  if (value === undefined) return fallback;
  switch (value.toLowerCase()) {
    case "1":
    case "true":
    case "yes":
      return true;
    case "0":
    case "false":
    case "no":
      return false;
    default:
      throw new Error(`${key} must be true or false.`);
  }
};

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);
