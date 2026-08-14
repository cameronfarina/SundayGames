import type { PlatformE2eEnv } from "./contracts.js";

export const optionalEnvFrom = (
  env: PlatformE2eEnv,
  key: string,
): string | undefined => {
  const value = env[key]?.trim();
  return value === undefined || value.length === 0 ? undefined : value;
};

export const optionalProcessEnv = (key: string): string | undefined =>
  optionalEnvFrom(process.env, key);
