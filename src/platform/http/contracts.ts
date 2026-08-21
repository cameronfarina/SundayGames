import type {
  AuthAttemptRateLimiter,
  ClientAddressRateLimiter,
} from "../authRateLimit.js";
import type { AccountOnboardingRepository } from "../accountOnboarding.js";
import type {
  EspnLeagueSettingsImportInput,
  EspnLeagueSettingsImportOutcome,
} from "../espnLeagueSettingsImport.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { LeagueSyncFetch } from "../../data/leagueSyncProviderAdapters.js";
import type { LeagueConnectionRepository } from "../leagueConnections.js";
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
import type { PlayerNewsRepository } from "../playerNews.js";
import type { PostDraftProjectionSnapshot } from "../postDraftTeamAnalysis.js";
import { createPlatformApp } from "../platformApp.js";

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
  accountOnboardingRepository?: AccountOnboardingRepository | undefined;
  onboardingRepository?: PlatformOnboardingRepository | undefined;
  playerNewsRepository?: PlayerNewsRepository | undefined;
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
  accountRateLimiter?: AuthAttemptRateLimiter | undefined;
  loginRateLimiter?: AuthAttemptRateLimiter | undefined;
  verificationRateLimiter?: AuthAttemptRateLimiter | undefined;
  passwordResetRateLimiter?: AuthAttemptRateLimiter | undefined;
  passwordResetConsumeRateLimiter?: AuthAttemptRateLimiter | undefined;
  authClientRateLimiter?: AuthAttemptRateLimiter | undefined;
  leagueMembersScreenshotAnalyzer?: LeagueMembersScreenshotAnalyzer | undefined;
  screenshotImportRateLimiter?: ClientAddressRateLimiter | undefined;
  leagueImportRateLimiter?: ClientAddressRateLimiter | undefined;
  simulationRateLimiter?: ClientAddressRateLimiter | undefined;
  liveDraftMutationRateLimiter?: ClientAddressRateLimiter | undefined;
  openLiveDraftRoomRevisionSubscription?: ((input: {
    accountId: string;
    roomId: string;
  }) => LiveDraftRoomEventStreamSubscription | Promise<LiveDraftRoomEventStreamSubscription>) | undefined;
  leagueConnectionRepository?: LeagueConnectionRepository | undefined;
  leagueSyncFetch?: LeagueSyncFetch | undefined;
  runLeagueSyncSeasonRefresh?: (<T>(operation: () => Promise<T>) => Promise<T>) | undefined;
}
