import { pathToFileURL } from "node:url";
import { createSimulationRunnerForRuntime } from "./currentLeagueSimulationRunner.js";
import { createNodePostgresClient, type NodePostgresClient } from "./postgresClient.js";
import { readPlatformRuntimeConfig } from "./platformRuntimeConfig.js";
import { startPlatformServer, type StartedPlatformServer } from "./platformServer.js";

export interface StartedPlatformWebProcess {
  server: StartedPlatformServer;
  postgresClient: NodePostgresClient | undefined;
  close: () => Promise<void>;
}

export const startPlatformWebFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
): Promise<StartedPlatformWebProcess> => {
  const config = readPlatformRuntimeConfig(env, { requireDurableStore: true });
  const simulationRunner = await createSimulationRunnerForRuntime(config);
  const postgresClient = config.databaseUrl === undefined
    ? undefined
    : createNodePostgresClient({
      databaseUrl: config.databaseUrl,
      max: config.postgresPoolSize,
      statementTimeoutMs: config.postgresStatementTimeoutMs,
    });
  const server = await startPlatformServer({
    host: config.host,
    port: config.port,
    dataFilePath: config.dataFilePath,
    postgresClient,
    postgresAuthClient: postgresClient,
    postgresJobClient: postgresClient,
    postgresSimulationClient: postgresClient,
    postgresSnapshotKey: config.postgresSnapshotKey,
    initializePostgresSchema: config.initializePostgresSchema,
    simulationRunner,
  });

  return {
    server,
    postgresClient,
    close: async () => {
      await server.close();
      await postgresClient?.close();
    },
  };
};

const run = async (): Promise<void> => {
  const processRuntime = await startPlatformWebFromEnv();

  console.log(`Mockd platform web listening at ${processRuntime.server.url}`);

  const shutdown = async (): Promise<void> => {
    await processRuntime.close();
  };

  process.once("SIGINT", () => {
    void shutdown().finally(() => process.exit(0));
  });
  process.once("SIGTERM", () => {
    void shutdown().finally(() => process.exit(0));
  });
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
