import { pathToFileURL } from "node:url";
import { backfillLeagueConnectionCredentials } from
  "./leagueConnectionCredentialBackfill.js";
import { createNodePostgresClient } from "./postgresClient.js";
import { readPlatformRuntimeConfig } from "./platformRuntimeConfig.js";

export const runLeagueConnectionCredentialBackfillFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<number> => {
  const config = readPlatformRuntimeConfig(env, { requireDatabase: true });
  const databaseUrl = config.databaseUrl;
  const cipher = config.leagueConnectionCredentialCipher;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  if (cipher === undefined) throw new Error("ESPN credential encryption is required.");
  const client = createNodePostgresClient({
    databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });
  let migrated = 0;
  try {
    while (true) {
      const result = await backfillLeagueConnectionCredentials(client, cipher);
      migrated += result.migrated;
      if (result.complete) return migrated;
      if (result.migrated === 0) {
        throw new Error("League connection credential backfill made no progress.");
      }
    }
  } finally {
    await client.close();
  }
};

const run = async (): Promise<void> => {
  try {
    const migrated = await runLeagueConnectionCredentialBackfillFromEnv();
    console.log(`Secured ${migrated} league connection credential records.`);
  } catch {
    console.error("League connection credential backfill failed.");
    process.exitCode = 1;
  }
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run();
}
