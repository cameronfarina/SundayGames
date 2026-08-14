import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  inspectPlatformPostgresReadiness,
  probeWritableDraftToolsDirectory,
} from "./checkPlatformProductionReadiness.js";
import { createSimulationRunnerForRuntime } from "./currentLeagueSimulationRunner.js";
import {
  currentLeagueInitialRostersFor,
  loadCurrentPlayerCatalog,
  loadLocalDemoPlayerCatalog,
} from "./localDemoFixtures.js";
import { liveDraftRoomSetupContentHash, type LiveDraftRoomSetup } from "./liveDraftRoomSetups.js";
import type { LeagueSeason } from "./leagueSeason.js";
import { createNodePostgresClient, type NodePostgresClient } from "./postgresClient.js";
import { observePlatformNodeHttpServer } from "./platformNodeHttp.js";
import {
  readPlatformWebRuntimeConfig,
  type PlatformRuntimeConfig,
} from "./platformRuntimeConfig.js";
import { startPlatformServer, type StartedPlatformServer } from "./platformServer.js";
import { createOpenAiLeagueMembersScreenshotAnalyzer } from "./openAiLeagueMembersScreenshotAnalyzer.js";
import {
  importEspnLeagueSettings,
  type EspnLeagueSettingsImportInput,
  type EspnLeagueSettingsImportOutcome,
} from "./espnLeagueSettingsImport.js";
import { loadCurrentPostDraftProjectionSnapshot } from "./currentPostDraftProjectionSnapshot.js";
import { createResendAuthMailSender } from "./resendAuthMailSender.js";
import type { AuthMailSender } from "./auth.js";
import {
  loadPlatformStaticWebAssets,
  type PlatformStaticWebAssets,
} from "./platformStaticWebAssets.js";

export interface StartedPlatformWebProcess {
  server: StartedPlatformServer;
  postgresClient: NodePostgresClient | undefined;
  close: () => Promise<void>;
}

export interface StartPlatformWebDependencies {
  authMailSender?: AuthMailSender | undefined;
  staticWebAssets?: PlatformStaticWebAssets | undefined;
}

const staticWebAssetsFor = async (
  env: NodeJS.ProcessEnv,
  dependencies: StartPlatformWebDependencies,
): Promise<PlatformStaticWebAssets | undefined> => {
  if (dependencies.staticWebAssets !== undefined) return dependencies.staticWebAssets;
  if (env.NODE_ENV === "test") return undefined;

  return await loadPlatformStaticWebAssets(resolve(env.MOCKD_WEB_ASSETS_DIRECTORY ?? "dist/web"));
};

export const createPlatformWebReadinessProbe = (
  config: Pick<PlatformRuntimeConfig, "draftToolsSessionDirectory" | "liveDraftDataMode">,
  postgresClient: NodePostgresClient | undefined,
): (() => Promise<boolean>) => async () => {
  if (config.liveDraftDataMode === "postgres" && postgresClient === undefined) return false;
  if (postgresClient !== undefined) {
    const databaseReadiness = await inspectPlatformPostgresReadiness(postgresClient);
    if (databaseReadiness.status !== "ready") return false;
  }

  try {
    await probeWritableDraftToolsDirectory(config.draftToolsSessionDirectory);
    return true;
  } catch {
    return false;
  }
};

const localFixtureDraftSetupFor = async (season: LeagueSeason): Promise<LiveDraftRoomSetup> => {
  const input = {
    seasonId: season.id,
    sourceVersion: "local-fixtures-2026",
    playerCatalog: await loadLocalDemoPlayerCatalog(),
    initialRosters: currentLeagueInitialRostersFor(season),
  };

  return {
    ...input,
    contentHash: liveDraftRoomSetupContentHash(input),
    updatedAt: new Date(),
  };
};

const importEspnLeagueSettingsForRuntime = (
  input: EspnLeagueSettingsImportInput,
): Promise<EspnLeagueSettingsImportOutcome> =>
  importEspnLeagueSettings(input, async request => {
    const response = await fetch(request.url, {
      method: request.method,
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      // The importer maps authorization status before it examines an ESPN response body.
    }

    return { code: response.status, body };
  });

export const startPlatformWebFromEnv = async (
  env: NodeJS.ProcessEnv = process.env,
  dependencies: StartPlatformWebDependencies = {},
): Promise<StartedPlatformWebProcess> => {
  const config = readPlatformWebRuntimeConfig(env);
  const staticWebAssets = await staticWebAssetsFor(env, dependencies);
  const simulationRunner = await createSimulationRunnerForRuntime(config);
  const postgresClient = config.databaseUrl === undefined
    ? undefined
    : createNodePostgresClient({
      databaseUrl: config.databaseUrl,
      max: config.postgresPoolSize,
      statementTimeoutMs: config.postgresStatementTimeoutMs,
    });
  const readinessProbe = createPlatformWebReadinessProbe(config, postgresClient);
  const authMailSender = dependencies.authMailSender ?? (config.authEmail.mode === "resend"
    && config.authEmail.resendApiKey !== undefined
    && config.authEmail.from !== undefined
      ? createResendAuthMailSender({ apiKey: config.authEmail.resendApiKey, from: config.authEmail.from })
      : undefined);
  const screenshotAnalyzer = config.screenshotImport.mode === "openai" && config.screenshotImport.apiKey !== undefined
    ? createOpenAiLeagueMembersScreenshotAnalyzer({
        apiKey: config.screenshotImport.apiKey,
        model: config.screenshotImport.model,
        timeoutMs: config.screenshotImport.timeoutMs,
        maxImageBytes: config.screenshotImport.maxImageBytes,
        maxConcurrentRequests: config.screenshotImport.maxConcurrentRequests,
      })
    : undefined;
  let server: StartedPlatformServer;
  try {
    server = await startPlatformServer({
      ...(staticWebAssets === undefined
        ? {}
        : { appHtml: staticWebAssets.indexHtml, browserAssets: staticWebAssets.files }),
      host: config.host,
      port: config.port,
      dataFilePath: config.dataFilePath,
      postgresClient,
      postgresAuthClient: postgresClient,
      postgresLeagueSetupClient: postgresClient,
      postgresHistoricalImportClient: postgresClient,
      postgresJobClient: postgresClient,
      postgresSimulationClient: postgresClient,
      postgresLiveDraftRoomClient: postgresClient,
      postgresExportArtifactClient: postgresClient,
      postgresSnapshotKey: config.postgresSnapshotKey,
      initializePostgresSchema: config.initializePostgresSchema,
      draftToolsSessionDirectory: config.draftToolsSessionDirectory,
      legacyMockBatchEnabled: config.legacyMockBatchEnabled,
      allowPublicSignup: config.allowPublicSignup,
      emailVerificationRequired: config.authEmail.mode === "resend",
      ...(authMailSender === undefined ? {} : { authMailSender }),
      ...(config.authEmail.publicBaseUrl === undefined ? {} : { publicBaseUrl: config.authEmail.publicBaseUrl }),
      trustProxy: config.trustProxy,
      provisioningToken: config.provisioningToken,
      invitationTokenSecret: config.invitationTokenSecret,
      screenshotImportBodyLimitBytes:
        Math.ceil(config.screenshotImport.maxImageBytes * 4 / 3) + 65_536,
      shellCapabilities: {
        leagueCreationScreenshotAnalysis: screenshotAnalyzer !== undefined,
      },
      currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
      postDraftProjectionProvider: loadCurrentPostDraftProjectionSnapshot,
      espnLeagueSettingsImporter: importEspnLeagueSettingsForRuntime,
      ...(screenshotAnalyzer === undefined
        ? {}
        : { leagueMembersScreenshotAnalyzer: screenshotAnalyzer }),
      ...(config.liveDraftDataMode === "local-fixtures"
        ? { liveDraftRoomSetupProvider: localFixtureDraftSetupFor }
        : {}),
      readinessProbe,
      simulationRunner,
    });
  } catch (error) {
    try {
      await postgresClient?.close();
    } catch {
      // Preserve the startup failure; cleanup errors must not replace its cause.
    }
    throw error;
  }
  const stopObserving = observePlatformNodeHttpServer(server.server);

  return {
    server,
    postgresClient,
    close: async () => {
      stopObserving();
      try {
        await server.close();
      } finally {
        await postgresClient?.close();
      }
    },
  };
};

const run = async (): Promise<void> => {
  const processRuntime = await startPlatformWebFromEnv();

  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    level: "info",
    event: "platform_started",
    host: processRuntime.server.host,
    port: processRuntime.server.port,
  }));

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
  void run().catch(() => {
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event: "platform_startup_failed",
      errorCode: "startup_failed",
    }));
    process.exit(1);
  });
}
