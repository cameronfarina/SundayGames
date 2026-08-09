import { pathToFileURL } from "node:url";
import { createNodePostgresClient } from "./postgresClient.js";
import { applyPlatformPostgresMigrations } from "./platformMigrations.js";
import { readPlatformRuntimeConfig } from "./platformRuntimeConfig.js";

export const runPlatformMigrationsFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ statementCount: number }> => {
  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");

  const postgresClient = createNodePostgresClient({
    databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });

  try {
    return await applyPlatformPostgresMigrations(postgresClient);
  } finally {
    await postgresClient.close();
  }
};

const run = async (): Promise<void> => {
  const result = await runPlatformMigrationsFromEnv();
  console.log(`Applied ${result.statementCount} platform migration statements.`);
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
