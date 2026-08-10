import { pathToFileURL } from "node:url";
import { createSimulationRunnerForRuntime } from "./currentLeagueSimulationRunner.js";
import { createNodePostgresClient } from "./postgresClient.js";
import { readPlatformRuntimeConfig } from "./platformRuntimeConfig.js";
import { createPlatformServer } from "./platformServer.js";
import { runPlatformWorkerLoop, type PlatformWorkerLoopStats } from "./platformWorker.js";

export const startPlatformWorkerFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  abortSignal?: AbortSignal,
): Promise<PlatformWorkerLoopStats> => {
  const config = readPlatformRuntimeConfig(env, {
    requireDatabase: true,
    requireRunnableWorker: true,
  });
  const databaseUrl = config.databaseUrl;
  if (databaseUrl === undefined) throw new Error("DATABASE_URL is required.");

  const postgresClient = createNodePostgresClient({
    databaseUrl,
    max: config.postgresPoolSize,
    statementTimeoutMs: config.postgresStatementTimeoutMs,
  });

  try {
    const simulationRunner = await createSimulationRunnerForRuntime(config);
    const platformServer = await createPlatformServer({
      postgresClient,
      postgresAuthClient: postgresClient,
      postgresJobClient: postgresClient,
      postgresSimulationClient: postgresClient,
      postgresSnapshotKey: config.postgresSnapshotKey,
      initializePostgresSchema: config.initializePostgresSchema,
      simulationRunner,
    });

    try {
      return await runPlatformWorkerLoop({
        repository: platformServer.jobRepository,
        workerId: config.worker.workerId,
        pollIntervalMs: config.worker.pollIntervalMs,
        lockTtlMs: config.worker.lockTtlMs,
        jobKinds: config.worker.jobKinds,
        handlers: platformServer.jobHandlers,
        abortSignal,
        onError: error => {
          console.error(error);
        },
      });
    } finally {
      await platformServer.close();
    }
  } finally {
    await postgresClient.close();
  }
};

const run = async (): Promise<void> => {
  const abortController = new AbortController();
  process.once("SIGINT", () => abortController.abort());
  process.once("SIGTERM", () => abortController.abort());

  const stats = await startPlatformWorkerFromEnv(process.env, abortController.signal);
  console.log(JSON.stringify({ worker: stats }));
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void run().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
