import { createSimulationRunnerForRuntime } from "../currentLeagueSimulationRunner.js";
import { observePlatformNodeHttpServer } from "../platformNodeHttp.js";
import { createNodePostgresClient } from "../postgresClient.js";
import { readPlatformWebRuntimeConfig } from "../platformRuntimeConfig.js";
import { startPlatformServer, type StartedPlatformServer } from "../platformServer.js";
import type {
  StartedPlatformWebProcess,
  StartPlatformWebDependencies,
} from "./contracts.js";
import {
  closePlatformWebRuntime,
  closePostgresAfterStartupFailure,
} from "./processLifecycle.js";
import {
  authMailSenderFor,
  fantasyProsClientFor,
  screenshotAnalyzerFor,
  signupNotifierFor,
} from "./runtimeServices.js";
import { startFantasyProsRefreshIfConfigured } from "./fantasyProsRefresh.js";
import { platformWebServerOptions } from "./serverOptions.js";
import { staticWebAssetsFor } from "./staticAssets.js";
import { startSimulationReconciliation } from "./simulationReconciliation.js";

export const startPlatformWebFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  dependencies: StartPlatformWebDependencies = {},
): Promise<StartedPlatformWebProcess> => {
  const config = readPlatformWebRuntimeConfig(env);
  const staticWebAssets = await staticWebAssetsFor(env, dependencies);
  const simulationRunner = await createSimulationRunnerForRuntime(config);
  const postgresClientFactory = dependencies.postgresClientFactory
    ?? createNodePostgresClient;
  const postgresClient = config.databaseUrl === undefined
    ? undefined
    : postgresClientFactory({
        databaseUrl: config.databaseUrl,
        max: config.postgresPoolSize,
        statementTimeoutMs: config.postgresStatementTimeoutMs,
      });
  const closePostgres = postgresClient === undefined
    ? undefined
    : async () => await postgresClient.close();
  const options = platformWebServerOptions(config, {
    staticWebAssets,
    simulationRunner,
    postgresClient,
    authMailSender: authMailSenderFor(config, dependencies.authMailSender),
    signupNotifier: signupNotifierFor(config, dependencies.signupNotifier),
    screenshotAnalyzer: screenshotAnalyzerFor(config),
  });

  let server: StartedPlatformServer;
  try {
    server = await startPlatformServer(options);
  } catch (error) {
    await closePostgresAfterStartupFailure(closePostgres);
    throw error;
  }
  const stopObserving = observePlatformNodeHttpServer(server.server);
  const stopSimulationReconciliation = startSimulationReconciliation(server.simulationRepository);
  const fantasyProsRefresh = startFantasyProsRefreshIfConfigured({
    client: fantasyProsClientFor(config),
    repository: server.fantasyProsRepository,
    playerNewsRepository: server.playerNewsRepository,
    playerNewsEnabled: config.playerNews.refreshEnabled,
  });
  return {
    server,
    postgresClient,
    close: () => closePlatformWebRuntime({
      stopObserving,
      stopSimulationReconciliation,
      stopFantasyProsRefresh: () => fantasyProsRefresh?.stop(),
      closeServer: async () => await server.close(),
      closePostgres,
    }),
  };
};
