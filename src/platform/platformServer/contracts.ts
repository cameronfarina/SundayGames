import type { AuthMailSender, AuthRepository, SignupNotifier } from "../auth.js";
import type { AccountOnboardingRepository } from "../accountOnboarding.js";
import type {
  AuthAttemptRateLimiter,
  ClientAddressRateLimiter,
} from "../authRateLimit.js";
import type { ExportArtifactRepository } from "../exportArtifacts.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { HistoricalImportRepository } from "../historicalImports.js";
import type { JobRepository } from "../jobs.js";
import type { LeagueSyncFetch } from "../../data/leagueSyncProviderAdapters.js";
import type { LeagueConnectionRepository } from "../leagueConnections.js";
import type { LeagueConnectionCredentialCipher } from
  "../leagueConnectionCredentialEncryption.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomSetup,
  LiveDraftRoomSetupRepository,
} from "../liveDraftRoomSetups.js";
import type { LeagueMembersScreenshotAnalyzer } from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { PlatformOnboardingRepository } from "../platformOnboarding.js";
import type { PlatformInvitationRepository } from "../platformInvitations.js";
import type { PlatformBrowserAsset } from "../platformStaticWebAssets.js";
import type { PostDraftProjectionSnapshot } from "../postDraftTeamAnalysis.js";
import type { PlayerNewsRepository } from "../playerNews.js";
import type { PracticeShortlistRepository } from "../practiceShortlists.js";
import type { PracticePersistenceMode } from "../practicePersistenceMode.js";
import type { MockDraftSessionRepository } from "../mockSessions.js";
import type { PostgresTransactionalQueryClient } from "../postgresJobQueue.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import type { EspnLeagueSettingsImportInput, EspnLeagueSettingsImportOutcome } from "../espnLeagueSettingsImport.js";
import type { LiveDraftRoomPlayerCatalogEntry, LiveDraftRoomRepository } from "../liveDraftRooms.js";
import type { SimulationMockBatchRunner, SimulationRepository } from "../simulations.js";

export type { PlatformServer, StartPlatformServerOptions, StartedPlatformServer } from "./serverHandleContracts.js";

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
  practicePersistenceMode?: PracticePersistenceMode | undefined;
  initializePostgresSchema?: boolean | undefined;
  authRepository?: AuthRepository | undefined;
  accountOnboardingRepository?: AccountOnboardingRepository | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  historicalImportRepository?: HistoricalImportRepository | undefined;
  jobRepository?: JobRepository | undefined;
  simulationRepository?: SimulationRepository | undefined;
  mockDraftSessionRepository?: MockDraftSessionRepository | undefined;
  practiceShortlistRepository?: PracticeShortlistRepository | undefined;
  playerNewsRepository?: PlayerNewsRepository | undefined;
  fantasyProsRepository?: FantasyProsRepository | undefined;
  fantasyProsConfigured?: boolean | undefined;
  leagueConnectionRepository?: LeagueConnectionRepository | undefined;
  leagueConnectionCredentialCipher?: LeagueConnectionCredentialCipher | undefined;
  leagueSyncFetch?: LeagueSyncFetch | undefined;
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
  signupNotifier?: SignupNotifier | undefined;
  trustProxy?: boolean | undefined;
  accountRateLimiter?: AuthAttemptRateLimiter | undefined;
  loginRateLimiter?: AuthAttemptRateLimiter | undefined;
  verificationRateLimiter?: AuthAttemptRateLimiter | undefined;
  passwordResetRateLimiter?: AuthAttemptRateLimiter | undefined;
  passwordResetConsumeRateLimiter?: AuthAttemptRateLimiter | undefined;
  authClientRateLimiter?: AuthAttemptRateLimiter | undefined;
  screenshotImportRateLimiter?: ClientAddressRateLimiter | undefined;
  screenshotImportIngressRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportAccountRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportClientRateLimiter?: ClientAddressRateLimiter | undefined;
  historicalImportMaxConcurrentPerAccount?: number | undefined;
  historicalImportMaxConcurrentPerClient?: number | undefined;
  simulationCompletionMaxConcurrentPerAccount?: number | undefined;
  simulationCompletionMaxConcurrentPerClient?: number | undefined;
  leagueImportRateLimiter?: ClientAddressRateLimiter | undefined;
  simulationRateLimiter?: ClientAddressRateLimiter | undefined;
  liveDraftMutationRateLimiter?: ClientAddressRateLimiter | undefined;
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
