import type { AuthMailSender, SignupNotifier } from "../auth.js";
import { loadCurrentPostDraftProjectionSnapshot } from "../currentPostDraftProjectionSnapshot.js";
import { loadCurrentPlayerCatalog } from "../localDemoFixtures.js";
import type { LeagueMembersScreenshotAnalyzer } from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { NodePostgresClient } from "../postgresClient.js";
import type { PlatformRuntimeConfig } from "../platformRuntimeConfig.js";
import type { StartPlatformServerOptions } from "../platformServer.js";
import type { PlatformStaticWebAssets } from "../platformStaticWebAssets.js";
import type { SimulationMockBatchRunner } from "../simulations.js";
import { importEspnLeagueSettingsForRuntime } from "./espnImporter.js";
import { localFixtureDraftSetupFor } from "./localFixtures.js";
import { createPlatformWebReadinessProbe } from "./readiness.js";

export interface PlatformWebServerDependencies {
  authMailSender: AuthMailSender | undefined;
  signupNotifier: SignupNotifier | undefined;
  postgresClient: NodePostgresClient | undefined;
  screenshotAnalyzer: LeagueMembersScreenshotAnalyzer | undefined;
  simulationRunner: SimulationMockBatchRunner;
  staticWebAssets: PlatformStaticWebAssets | undefined;
}

export const platformWebServerOptions = (
  config: PlatformRuntimeConfig,
  dependencies: PlatformWebServerDependencies,
): StartPlatformServerOptions => ({
  ...(dependencies.staticWebAssets === undefined ? {} : {
    appHtml: dependencies.staticWebAssets.indexHtml,
    browserAssets: dependencies.staticWebAssets.files,
  }),
  host: config.host,
  port: config.port,
  dataFilePath: config.dataFilePath,
  postgresClient: dependencies.postgresClient,
  postgresAuthClient: dependencies.postgresClient,
  postgresLeagueSetupClient: dependencies.postgresClient,
  postgresHistoricalImportClient: dependencies.postgresClient,
  postgresJobClient: dependencies.postgresClient,
  postgresSimulationClient: dependencies.postgresClient,
  postgresLiveDraftRoomClient: dependencies.postgresClient,
  postgresExportArtifactClient: dependencies.postgresClient,
  postgresSnapshotKey: config.postgresSnapshotKey,
  initializePostgresSchema: config.initializePostgresSchema,
  draftToolsSessionDirectory: config.draftToolsSessionDirectory,
  legacyMockBatchEnabled: config.legacyMockBatchEnabled,
  allowPublicSignup: config.allowPublicSignup,
  emailVerificationRequired: config.authEmail.mode === "resend",
  ...(dependencies.authMailSender === undefined
    ? {}
    : { authMailSender: dependencies.authMailSender }),
  ...(dependencies.signupNotifier === undefined
    ? {}
    : { signupNotifier: dependencies.signupNotifier }),
  ...(config.authEmail.publicBaseUrl === undefined
    ? {}
    : { publicBaseUrl: config.authEmail.publicBaseUrl }),
  trustProxy: config.trustProxy,
  provisioningToken: config.provisioningToken,
  invitationTokenSecret: config.invitationTokenSecret,
  leagueConnectionCredentialCipher: config.leagueConnectionCredentialCipher,
  screenshotImportBodyLimitBytes:
    Math.ceil(config.screenshotImport.maxImageBytes * 4 / 3) + 65_536,
  currentPlayerCatalogProvider: loadCurrentPlayerCatalog,
  postDraftProjectionProvider: loadCurrentPostDraftProjectionSnapshot,
  espnLeagueSettingsImporter: importEspnLeagueSettingsForRuntime,
  ...(dependencies.screenshotAnalyzer === undefined
    ? {}
    : { leagueMembersScreenshotAnalyzer: dependencies.screenshotAnalyzer }),
  ...(config.liveDraftDataMode === "local-fixtures"
    ? { liveDraftRoomSetupProvider: localFixtureDraftSetupFor }
    : {}),
  fantasyProsConfigured: config.fantasyPros.apiKey !== undefined,
  readinessProbe: createPlatformWebReadinessProbe(config, dependencies.postgresClient),
  simulationRunner: dependencies.simulationRunner,
});
