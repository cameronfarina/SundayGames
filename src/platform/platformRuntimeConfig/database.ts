import type {
  PlatformDatabaseUrlEnvValue,
  PlatformProductionReadinessStorage,
  PlatformRuntimeEnv,
} from "./contracts.js";
import { optionalEnvString } from "./env.js";

export const databaseUrlEnv = (
  env: PlatformRuntimeEnv,
): PlatformDatabaseUrlEnvValue | undefined => {
  const databaseUrl = optionalEnvString(env, "DATABASE_URL");
  if (databaseUrl !== undefined) {
    return { envKey: "DATABASE_URL", value: databaseUrl };
  }
  const mockdDatabaseUrl = optionalEnvString(env, "MOCKD_DATABASE_URL");
  return mockdDatabaseUrl === undefined
    ? undefined
    : { envKey: "MOCKD_DATABASE_URL", value: mockdDatabaseUrl };
};

export const isPostgresDatabaseUrl = (databaseUrl: string): boolean => {
  try {
    const protocol = new URL(databaseUrl).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
};

export const productionReadinessStorage = (
  env: PlatformRuntimeEnv,
): PlatformProductionReadinessStorage => {
  const database = databaseUrlEnv(env);
  const dataFilePath = optionalEnvString(env, "MOCKD_PLATFORM_DATA_FILE");
  if (database !== undefined && dataFilePath !== undefined) {
    return {
      kind: "ambiguous",
      databaseEnvKey: database.envKey,
      dataFilePath,
    };
  }
  if (database !== undefined) return { kind: "postgres", envKey: database.envKey };
  if (dataFilePath !== undefined) return { kind: "file", dataFilePath };
  return { kind: "missing" };
};
