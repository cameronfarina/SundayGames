import type { Server } from "node:http";
import type { AuthMailSender, AuthRepository } from "../auth.js";
import type {
  ClientAddressRateLimiter,
  NormalizedEmailRateLimiter,
} from "../authRateLimit.js";
import type { ExportArtifactRepository } from "../exportArtifacts.js";
import type { FilePlatformStore } from "../filePlatformStore.js";
import type { HistoricalImportRepository } from "../historicalImports.js";
import type { JobRepository } from "../jobs.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomSetup,
  LiveDraftRoomSetupRepository,
  PostgresLiveDraftRoomSetupRepository,
} from "../liveDraftRoomSetups.js";
import type { LeagueMembersScreenshotAnalyzer } from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { PlatformApp, PlatformHttpHandler } from "../platformHttp.js";
import type { PlatformDraftToolsAdapter } from "../platformDraftToolsAdapter.js";
import type { PlatformJobHandlers } from "../platformJobOrchestrator.js";
import type { PlatformOnboardingRepository } from "../platformOnboarding.js";
import type { PlatformInvitationRepository } from "../platformInvitations.js";
import type { PlatformBrowserAsset } from "../platformStaticWebAssets.js";
import type { PostDraftProjectionSnapshot } from "../postDraftTeamAnalysis.js";
import type { PracticeShortlistRepository } from "../practiceShortlists.js";
import type { PostgresAuthRepository } from "../postgresAuth.js";
import type { PostgresExportArtifactRepository } from "../postgresExportArtifacts.js";
import type { PostgresHistoricalImportRepository } from "../postgresHistoricalImports.js";
import type { PostgresJobQueue, PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresLeagueSetupRepository } from "../postgresLeagueSetup.js";
import type { PostgresLiveDraftRoomRepository } from "../postgresLiveDraftRooms.js";
import type { PostgresPlatformInvitationRepository } from "../postgresPlatformInvitations.js";
import type { PostgresPlatformStore, PostgresQueryClient } from "../postgresPlatformStore.js";
import type { PostgresSimulationRepository } from "../postgresSimulations.js";
import type { EspnLeagueSettingsImportInput, EspnLeagueSettingsImportOutcome } from "../espnLeagueSettingsImport.js";
import type { LiveDraftRoomPlayerCatalogEntry, LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { SeasonSimulationRunner } from "../seasonSimulationWorkerRunner.js";
import type { SimulationMockBatchRunner, SimulationRepository } from "../simulations.js";
import type { InMemoryPlatformStore } from "../platformApp.js";

export type PlatformClock = () => Date;
export interface CreatePlatformServerOptions {
  appHtml?: string | undefined;
  browserAssets?: ReadonlyMap<string, PlatformBrowserAsset> | undefined;
  dataFilePath?: string | undefined;
  postgresClient?: PostgresQueryClient | undefined;
  postgresAuthClient?: PostgresQueryClient | undefined;
  postgresLeagueSetupClient?: PostgresTransactionalQueryClient | undefined;
  postgresHistoricalImportClient?: PostgresTransactionalQueryClient | undefined;
  postgresJobClient?: PostgresTransactionalQueryClient | undefined;
  postgresSimulationClient?: PostgresTransactionalQueryClient | undefined;
  postgresLiveDraftRoomClient?: PostgresTransactionalQueryClient | undefined;
  postgresExportArtifactClient?: PostgresTransactionalQueryClient | undefined;
  postgresSnapshotKey?: string | undefined;
  initializePostgresSchema?: boolean | undefined;
  authRepository?: AuthRepository | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  historicalImportRepository?: HistoricalImportRepository | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  practiceShortlistRepository?: PracticeShortlistRepository | undefined;
  liveDraftRoomRepository?: LiveDraftRoomRepository | undefined;
  exportArtifactRepository?: ExportArtifactRepository | undefined;
  invitationRepository?: PlatformInvitationRepository | undefined;
  onboardingRepository?: PlatformOnboardingRepository | undefined;
  currentPlayerCatalogProvider?: (() => Promise<readonly LiveDraftRoomPlayerCatalogEntry[]>) | undefined;
  espnLeagueSettingsImporter?: ((input: EspnLeagueSettingsImportInput) => Promise<EspnLeagueSettingsImportOutcome>) | undefined;
  liveDraftRoomSetupRepository?: LiveDraftRoomSetupRepository | undefined;
  liveDraftRoomSetupProvider?: ((season: LeagueSeason) => Promise<LiveDraftRoomSetup | null>) | undefined;
  postDraftProjectionProvider?: ((season: LeagueSeason, playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[], now: Date) => Promise<PostDraftProjectionSnapshot>) | undefined;
  provisioningToken?: string | undefined;
  invitationTokenSecret?: string | undefined;
  allowPublicSignup?: boolean | undefined;
  emailVerificationRequired?: boolean | undefined;
  authMailSender?: AuthMailSender | undefined;
  publicBaseUrl?: string | undefined;
  trustProxy?: boolean | undefined;
  accountRateLimiter?: NormalizedEmailRateLimiter | undefined;
  loginRateLimiter?: NormalizedEmailRateLimiter | undefined;
  verificationRateLimiter?: NormalizedEmailRateLimiter | undefined;
  passwordResetRateLimiter?: NormalizedEmailRateLimiter | undefined;
  passwordResetConsumeRateLimiter?: ClientAddressRateLimiter | undefined;
  authClientRateLimiter?: ClientAddressRateLimiter | undefined;
  screenshotImportRateLimiter?: ClientAddressRateLimiter | undefined;
  screenshotImportIngressRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportAccountRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportClientRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportMaxConcurrentPerAccount?: number | undefined;
  historicalImportMaxConcurrentPerClient?: number | undefined;
  leagueImportRateLimiter?: ClientAddressRateLimiter | undefined;
  simulationRateLimiter?: ClientAddressRateLimiter | undefined;
  liveDraftMutationRateLimiter?: ClientAddressRateLimiter | undefined;
  seasonSimulationRunner?: SeasonSimulationRunner | undefined;
  leagueMembersScreenshotAnalyzer?: LeagueMembersScreenshotAnalyzer | undefined;
  simulationRunner: SimulationMockBatchRunner;
  liveDraftRoomEventStreamMaxConnectionsPerAccount?: number | undefined;
  liveDraftRoomEventStreamMaxConnections?: number | undefined;
  liveDraftRoomEventStreamRetryAfterSeconds?: number | undefined;
  bodyLimitBytes?: number | undefined;
  screenshotImportBodyLimitBytes?: number | undefined;
  legacyMockBatchEnabled?: boolean | undefined;
  draftToolsSessionDirectory?: string | undefined;
  readinessProbe?: (() => boolean | Promise<boolean>) | undefined;
  now?: PlatformClock | undefined;
}

export interface PlatformServer {
  server: Server;
  app: PlatformApp;
  store: InMemoryPlatformStore;
  authRepository: AuthRepository;
  leagueSetupRepository: LeagueSetupRepository;
  historicalImportRepository: HistoricalImportRepository;
  jobRepository: JobRepository;
  simulationRepository: SimulationRepository;
  practiceShortlistRepository: PracticeShortlistRepository;
  liveDraftRoomRepository: LiveDraftRoomRepository;
  exportArtifactRepository: ExportArtifactRepository;
  invitationRepository: PlatformInvitationRepository;
  onboardingRepository: PlatformOnboardingRepository;
  liveDraftRoomSetupRepository?: LiveDraftRoomSetupRepository | undefined;
  handler: PlatformHttpHandler;
  draftToolsAdapter: PlatformDraftToolsAdapter;
  jobHandlers: PlatformJobHandlers;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
  postgresAuthRepository?: PostgresAuthRepository | undefined;
  postgresLeagueSetupRepository?: PostgresLeagueSetupRepository | undefined;
  postgresHistoricalImportRepository?: PostgresHistoricalImportRepository | undefined;
  postgresJobQueue?: PostgresJobQueue | undefined;
  postgresSimulationRepository?: PostgresSimulationRepository | undefined;
  postgresLiveDraftRoomRepository?: PostgresLiveDraftRoomRepository | undefined;
  postgresExportArtifactRepository?: PostgresExportArtifactRepository | undefined;
  postgresInvitationRepository?: PostgresPlatformInvitationRepository | undefined;
  postgresLiveDraftRoomSetupRepository?: PostgresLiveDraftRoomSetupRepository | undefined;
  persist: () => Promise<void>;
  close: () => Promise<void>;
}

export interface StartPlatformServerOptions extends CreatePlatformServerOptions {
  host?: string | undefined;
  port?: number | undefined;
}

export interface StartedPlatformServer extends PlatformServer {
  host: string;
  port: number;
  url: string;
}
