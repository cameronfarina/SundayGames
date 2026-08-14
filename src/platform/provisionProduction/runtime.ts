import { createNodePostgresClient } from "../postgresClient.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import type { ProductionProvisioningRuntime } from "./contracts.js";
import { createTransactionalProductionProvisioningRepository } from "./repository.js";

export const createProductionProvisioningRuntime = (
  config: PlatformRuntimeConfig,
): ProductionProvisioningRuntime => {
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");
  const client = createNodePostgresClient({
    databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });
  return {
    repository: createTransactionalProductionProvisioningRepository(client),
    close: async () => await client.close(),
  };
};
