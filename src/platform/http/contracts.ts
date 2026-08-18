import type {
  ClientAddressRateLimiter,
  NormalizedEmailRateLimiter,
} from "../authRateLimit.js";
import type {
  EspnLeagueSettingsImportInput,
  EspnLeagueSettingsImportOutcome,
} from "../espnLeagueSettingsImport.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { LeagueMembersScreenshotAnalyzer } from "../openAiLeagueMembersScreenshotAnalyzer.js";
import type { LeagueSetupRepository } from "../leagueSetup.js";
import type { LeagueSeason } from "../leagueSeason.js";
import type {
  LiveDraftRoomInitialRosterPlayer,
  LiveDraftRoomPlayerCatalogEntry,
} from "../liveDraftRooms.js";
import type { LiveDraftRoomEventStreamSubscription } from "../liveDraftRoomEventStream.js";
import type { LiveDraftRoomSetupRepository } from "../liveDraftRoomSetups.js";
import type { AcceptedPlatformInvitation, PlatformInvitationRepository } from "../platformInvitations.js";
import type { PlatformOnboardingRepository } from "../platformOnboarding.js";
import type { PostDraftProjectionSnapshot } from "../postDraftTeamAnalysis.js";
import { createPlatformApp } from "../platformApp.js";
import type { SeasonSimulationRunner } from "../seasonSimulationWorkerRunner.js";

export interface PlatformHttpRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, unknown> | undefined;
  now?: Date | undefined;
  sessionToken?: string | undefined;
  headers?: Record<string, string | undefined> | undefined;
  isSecure?: boolean | undefined;
  clientAddress?: string | undefined;
  signal?: AbortSignal | undefined;
}

export interface PlatformHttpErrorBody {
  error: { code: string; message: string };
}

export interface PlatformHttpResponse<TBody = unknown> {
  status: number;
  body: TBody | PlatformHttpErrorBody;
  headers?: Record<string, string | readonly string[] | undefined> | undefined;
}

export type PlatformApp = ReturnType<typeof createPlatformApp>;
export type PlatformHttpHandler = (request: PlatformHttpRequest) => Promise<PlatformHttpResponse>;

export interface PlatformHttpServices {
  onboardingRepository?: PlatformOnboardingRepository | undefined;
  currentPlayerCatalogProvider?: (() => Promise<readonly LiveDraftRoomPlayerCatalogEntry[]>) | undefined;
  espnLeagueSettingsImporter?: ((input: EspnLeagueSettingsImportInput) => Promise<EspnLeagueSettingsImportOutcome>) | undefined;
  fantasyProsRepository?: FantasyProsRepository | undefined;
  fantasyProsConfigured?: boolean | undefined;
  invitationRepository?: PlatformInvitationRepository | undefined;
  leagueSetupRepository?: LeagueSetupRepository | undefined;
  applyAcceptedMembership?: ((result: AcceptedPlatformInvitation) => void | Promise<void>) | undefined;
  invitationTokenSecret?: string | undefined;
  readinessProbe?: (() => boolean | Promise<boolean>) | undefined;
  liveDraftRoomSetupProvider?: ((season: LeagueSeason) => Promise<{
    playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
    initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  } | null>) | undefined;
  liveDraftRoomSetupRepository?: LiveDraftRoomSetupRepository | undefined;
  postDraftProjectionProvider?: ((
    season: LeagueSeason,
    playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
    now: Date,
  ) => Promise<PostDraftProjectionSnapshot>) | undefined;
  provisioningToken?: string | undefined;
  allowPublicSignup?: boolean | undefined;
  emailVerificationRequired?: boolean | undefined;
  accountRateLimiter?: NormalizedEmailRateLimiter | undefined;
  loginRateLimiter?: NormalizedEmailRateLimiter | undefined;
  verificationRateLimiter?: NormalizedEmailRateLimiter | undefined;
  passwordResetRateLimiter?: NormalizedEmailRateLimiter | undefined;
  passwordResetConsumeRateLimiter?: ClientAddressRateLimiter | undefined;
  authClientRateLimiter?: ClientAddressRateLimiter | undefined;
  leagueMembersScreenshotAnalyzer?: LeagueMembersScreenshotAnalyzer | undefined;
  screenshotImportRateLimiter?: ClientAddressRateLimiter | undefined;
  leagueImportRateLimiter?: ClientAddressRateLimiter | undefined;
  simulationRateLimiter?: ClientAddressRateLimiter | undefined;
  liveDraftMutationRateLimiter?: ClientAddressRateLimiter | undefined;
  openLiveDraftRoomRevisionSubscription?: ((input: {
    accountId: string;
    roomId: string;
  }) => LiveDraftRoomEventStreamSubscription) | undefined;
  seasonSimulationRunner?: SeasonSimulationRunner | undefined;
}
