import { createDisabledSimulationRunner } from "../currentLeagueSimulationRunner.js";
import { createNodePostgresClient, type NodePostgresClient } from "../postgresClient.js";
import { readPlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import { createPlatformServer } from "../platformServer.js";
import type {
  LocalE2eSeedEnv,
  LocalE2eSeedRuntime,
  LocalE2eSeedStorage,
} from "./contracts.js";

export const loadLocalE2eSeedRuntime = async (
  env: LocalE2eSeedEnv = process.env,
): Promise<LocalE2eSeedRuntime> => {
  const config = readPlatformRuntimeConfig(env, { requireDurableStore: true });
  const postgresClient: NodePostgresClient | undefined = config.databaseUrl === undefined
    ? undefined
    : createNodePostgresClient({
        databaseUrl: config.databaseUrl,
        max: config.postgresPoolSize,
        statementTimeoutMs: config.postgresStatementTimeoutMs,
      });
  const server = await createPlatformServer({
    dataFilePath: config.dataFilePath,
    postgresClient,
    postgresAuthClient: postgresClient,
    postgresLeagueSetupClient: postgresClient,
    postgresHistoricalImportClient: postgresClient,
    postgresJobClient: postgresClient,
    postgresSimulationClient: postgresClient,
    postgresSnapshotKey: config.postgresSnapshotKey,
    initializePostgresSchema: config.initializePostgresSchema,
    simulationRunner: createDisabledSimulationRunner(),
  });
  const storage: LocalE2eSeedStorage = config.databaseUrl === undefined
    ? { kind: "file", path: config.dataFilePath ?? "" }
    : {
        kind: "postgres",
        databaseUrl: config.databaseUrl,
        ...(config.postgresSnapshotKey === undefined ? {} : { snapshotKey: config.postgresSnapshotKey }),
      };
  let closed = false;
  return {
    storage,
    app: server.app,
    persist: server.persist,
    close: async () => {
      if (closed) return;
      closed = true;
      await server.close();
      await postgresClient?.close();
    },
  };
};
