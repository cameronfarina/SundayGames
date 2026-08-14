import { applyPlatformPostgresMigrations } from "../platformMigrations.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { CreatePlatformServerOptions } from "./contracts.js";

export const isTransactionalPostgresClient = (
  client: PostgresQueryClient,
): client is PostgresTransactionalQueryClient =>
  "transaction" in client && typeof client.transaction === "function";

export const initializePostgresSchemas = async (
  options: Pick<
    CreatePlatformServerOptions,
    | "initializePostgresSchema"
    | "postgresAuthClient"
    | "postgresClient"
    | "postgresHistoricalImportClient"
    | "postgresLeagueSetupClient"
    | "postgresJobClient"
    | "postgresSimulationClient"
    | "postgresLiveDraftRoomClient"
    | "postgresExportArtifactClient"
  >,
): Promise<void> => {
  if (options.initializePostgresSchema !== true) return;
  const migratedClients = new Set<PostgresTransactionalQueryClient>();
  const candidates = [
    options.postgresClient,
    options.postgresAuthClient,
    options.postgresLeagueSetupClient,
    options.postgresHistoricalImportClient,
    options.postgresJobClient,
    options.postgresSimulationClient,
    options.postgresLiveDraftRoomClient,
    options.postgresExportArtifactClient,
  ];
  for (const client of candidates) {
    if (client === undefined || !isTransactionalPostgresClient(client) || migratedClients.has(client)) {
      continue;
    }
    await applyPlatformPostgresMigrations(client);
    migratedClients.add(client);
  }
};
