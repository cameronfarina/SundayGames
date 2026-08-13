import { createServer, type Server } from "node:http";
import { FilePlatformStore } from "./filePlatformStore.js";
import type { JobRepository } from "./jobs.js";
import type { AuthMailSender, AuthRepository } from "./auth.js";
import {
  createClientAddressRateLimiter,
  createNormalizedEmailRateLimiter,
  type ClientAddressRateLimiter,
  type NormalizedEmailRateLimiter,
} from "./authRateLimit.js";
import type { HistoricalImportRepository } from "./historicalImports.js";
import { createHistoricalImportRequestAdmission } from "./historicalImportRequestAdmission.js";
import type { LeagueSetupRepository } from "./leagueSetup.js";
import type { LeagueSeason } from "./leagueSeason.js";
import { applyPlatformPostgresMigrations } from "./platformMigrations.js";
import {
  createPlatformApp,
  InMemoryPlatformStore,
} from "./platformApp.js";
import type { ExportArtifactRepository } from "./exportArtifacts.js";
import {
  LiveDraftRoomRevisionNotifier,
  LiveDraftRoomWaitLimitError,
} from "./liveDraftRoomRealtime.js";
import type {
  LiveDraftRoomPlayerCatalogEntry,
  LiveDraftRoomRepository,
} from "./liveDraftRooms.js";
import {
  PostgresJobQueue,
  type PostgresTransactionalQueryClient,
} from "./postgresJobQueue.js";
import { PostgresExportArtifactRepository } from "./postgresExportArtifacts.js";
import { PostgresLiveDraftRoomRepository } from "./postgresLiveDraftRooms.js";
import {
  PostgresPlatformStore,
  PostgresPlatformStoreError,
  type PostgresQueryClient,
} from "./postgresPlatformStore.js";
import { PostgresAuthRepository } from "./postgresAuth.js";
import { PostgresHistoricalImportRepository } from "./postgresHistoricalImports.js";
import { PostgresLeagueSetupRepository } from "./postgresLeagueSetup.js";
import { PostgresSimulationRepository } from "./postgresSimulations.js";
import { PostgresPracticeShortlistRepository } from "./postgresPracticeShortlists.js";
import type { PracticeShortlistRepository } from "./practiceShortlists.js";
import {
  createPlatformHttpHandler,
  type PlatformApp,
  type PlatformHttpHandler,
  type PlatformHttpRequest,
  type PlatformHttpResponse,
} from "./platformHttp.js";
import {
  createPlatformJobHandlers,
} from "./platformJobHandlers.js";
import {
  platformJobTypes,
  type PlatformJobHandlers,
} from "./platformJobOrchestrator.js";
import {
  createPlatformNodeHttpAdapter,
  platformSessionTokenForHeaders,
} from "./platformNodeHttp.js";
import {
  createPlatformDraftToolsAdapter,
  type PlatformDraftToolsAdapter,
} from "./platformDraftToolsAdapter.js";
import { buildSeasonDraftToolsOptions } from "./platformSeasonDraftTools.js";
import { platformHostedDraftRoomHtml } from "./hostedDraftRoomUi.js";
import {
  createPlatformShellHtml,
  type PlatformShellCapabilities,
} from "./platformShellUi.js";
import {
  InMemoryPlatformInvitationRepository,
  type AcceptedPlatformInvitation,
  type PlatformInvitationRepository,
} from "./platformInvitations.js";
import { PostgresPlatformInvitationRepository } from "./postgresPlatformInvitations.js";
import {
  liveDraftRoomSetupContentHash,
  PostgresLiveDraftRoomSetupRepository,
  type LiveDraftRoomSetup,
  type LiveDraftRoomSetupRepository,
} from "./liveDraftRoomSetups.js";
import {
  InMemoryPlatformOnboardingRepository,
  PostgresPlatformOnboardingRepository,
  type PlatformOnboardingRepository,
} from "./platformOnboarding.js";
import type {
  SimulationMockBatchRunner,
  SimulationRepository,
} from "./simulations.js";
import type { LeagueMembersScreenshotAnalyzer } from "./openAiLeagueMembersScreenshotAnalyzer.js";
import type {
  EspnLeagueSettingsImportInput,
  EspnLeagueSettingsImportOutcome,
} from "./espnLeagueSettingsImport.js";
import type { PostDraftProjectionSnapshot } from "./postDraftTeamAnalysis.js";
import {
  createNodeSeasonSimulationRunner,
  type SeasonSimulationRunner,
} from "./seasonSimulationWorkerRunner.js";

export type PlatformClock = () => Date;

export interface CreatePlatformServerOptions {
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
  espnLeagueSettingsImporter?: ((
    input: EspnLeagueSettingsImportInput,
  ) => Promise<EspnLeagueSettingsImportOutcome>) | undefined;
  liveDraftRoomSetupRepository?: LiveDraftRoomSetupRepository | undefined;
  liveDraftRoomSetupProvider?: ((season: LeagueSeason) => Promise<LiveDraftRoomSetup | null>) | undefined;
  postDraftProjectionProvider?: ((
    season: LeagueSeason,
    playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
    now: Date,
  ) => Promise<PostDraftProjectionSnapshot>) | undefined;
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
  shellCapabilities?: PlatformShellCapabilities | undefined;
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

const mutatingHttpMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const eventStreamKeepAliveBody = ": keep-alive\n\n";
const liveRoomMutationActions = new Set([
  "start",
  "pause",
  "resume",
  "reopen",
  "sales",
  "sale",
  "corrections",
  "correction",
  "undo",
  "end",
]);

interface LiveDraftRoomEventStreamRequest {
  roomId: string;
  afterRevision: number;
}

const withTrustedNow = (
  request: PlatformHttpRequest,
  now: PlatformClock | undefined,
): PlatformHttpRequest => {
  const trustedNow = now?.() ?? request.now;
  if (trustedNow === undefined) return request;

  return {
    ...request,
    now: trustedNow,
  };
};

const shouldPersistAfter = (
  request: PlatformHttpRequest,
  responseStatus: number,
): boolean =>
  mutatingHttpMethods.has(request.method.toUpperCase()) &&
  responseStatus >= 200 &&
  responseStatus < 300;

const pathSegmentsFor = (request: PlatformHttpRequest): readonly string[] | null => {
  try {
    return new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));
  } catch {
    return null;
  }
};

const queryNumberFor = (
  request: PlatformHttpRequest,
  key: string,
): number | undefined => {
  try {
    const value = new URL(request.path, "http://mockd.local").searchParams.get(key);
    if (value === null || value.trim().length === 0) return undefined;

    return Number(value);
  } catch {
    return undefined;
  }
};

const liveDraftRoomEventStreamRequestFor = (
  request: PlatformHttpRequest,
): LiveDraftRoomEventStreamRequest | null => {
  if (request.method.toUpperCase() !== "GET") return null;

  const segments = pathSegmentsFor(request);
  if (
    segments === null ||
    segments.length !== 3 ||
    segments[0] !== "live-rooms" ||
    (segments[2] !== "event-stream" && segments[2] !== "events-stream")
  ) {
    return null;
  }

  const queryAfterRevision = queryNumberFor(request, "afterRevision");
  const explicitAfterRevision = typeof request.query?.afterRevision === "number"
    ? request.query.afterRevision
    : undefined;

  return {
    roomId: segments[1] ?? "",
    afterRevision: explicitAfterRevision ?? queryAfterRevision ?? 0,
  };
};

const isKeepAliveEventStreamResponse = (
  response: Awaited<ReturnType<PlatformHttpHandler>>,
): boolean => {
  const contentType = Object.entries(response.headers ?? {})
    .find(([name]) => name.toLowerCase() === "content-type")?.[1];
  const firstContentType = Array.isArray(contentType) ? contentType[0] : contentType;

  return response.status === 200 &&
    firstContentType?.toLowerCase().startsWith("text/event-stream") === true &&
    response.body === eventStreamKeepAliveBody;
};

export const liveDraftRoomRevisionNotificationFor = (
  request: PlatformHttpRequest,
  response: Awaited<ReturnType<PlatformHttpHandler>>,
): { roomId: string; revision: number } | null => {
  if (response.status < 200 || response.status >= 300) return null;

  const segments = pathSegmentsFor(request);
  if (segments === null) return null;
  const method = request.method.toUpperCase();
  const isLiveRoomMutation = segments[0] === "live-rooms" &&
    method === "POST" &&
    (
      segments.length === 1 ||
      (segments.length === 3 && liveRoomMutationActions.has(segments[2] ?? ""))
    );
  const isKeeperMutation = segments[0] === "seasons" &&
    segments[2] === "keepers" &&
    (
      (method === "POST" && segments.length === 4 && segments[3] === "apply") ||
      (method === "DELETE" && segments.length === 3)
    );
  const isHistoricalImportCommit = segments[0] === "historical-imports" &&
    segments[2] === "commit" &&
    method === "POST";
  if (!isLiveRoomMutation && !isKeeperMutation && !isHistoricalImportCommit) return null;

  const body = response.body;
  if (body === null || typeof body !== "object" || Array.isArray(body)) return null;

  const room = (body as { room?: unknown }).room;
  if (room === null || typeof room !== "object" || Array.isArray(room)) return null;

  const roomId = (room as { roomId?: unknown }).roomId;
  const revision = (room as { revision?: unknown }).revision;
  return typeof roomId === "string" && typeof revision === "number"
    ? { roomId, revision }
    : null;
};

const notifyLiveDraftRoomRevision = (
  notifier: LiveDraftRoomRevisionNotifier,
  request: PlatformHttpRequest,
  response: Awaited<ReturnType<PlatformHttpHandler>>,
): void => {
  const notification = liveDraftRoomRevisionNotificationFor(request, response);
  if (notification === null) return;

  notifier.notifyRevision(notification.roomId, notification.revision);
};

class DraftMutationResponseRollback extends Error {
  constructor(readonly response: PlatformHttpResponse) {
    super(`Draft mutation returned HTTP ${response.status}.`);
  }
}

const draftMutationSeasonIdFor = async (
  request: PlatformHttpRequest,
  liveDraftRoomRepository: LiveDraftRoomRepository,
): Promise<string | null> => {
  const segments = pathSegmentsFor(request);
  if (segments === null) return null;
  const method = request.method.toUpperCase();
  if (
    segments[0] === "seasons" &&
    typeof segments[1] === "string" &&
    (
      (segments[2] === "keepers" && (
        (method === "POST" && segments[3] === "apply") ||
        (method === "DELETE" && segments.length === 3)
      )) ||
      (segments[2] === "live-room" && method === "POST")
    )
  ) {
    return segments[1];
  }
  if (
    segments[0] === "historical-imports" &&
    segments[2] === "commit" &&
    method === "POST" &&
    request.body !== null &&
    typeof request.body === "object" &&
    !Array.isArray(request.body)
  ) {
    const seasonId = (request.body as { seasonId?: unknown }).seasonId;
    return typeof seasonId === "string" && seasonId.length > 0 ? seasonId : null;
  }
  if (segments[0] === "live-rooms" && segments[2] === "start" && method === "POST") {
    try {
      return (await liveDraftRoomRepository.getRoom(segments[1] ?? "")).seasonId;
    } catch {
      return null;
    }
  }

  return null;
};

const isJobOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  const segments = pathSegmentsFor(request);
  if (segments === null) return false;

  return segments[0] === "simulations" &&
    segments.length === 3 &&
    (segments[2] === "jobs" || segments[2] === "enqueue");
};

const isSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  const segments = pathSegmentsFor(request);
  if (segments === null) return false;

  return segments[0] === "simulations" &&
    (
      segments.length === 1 ||
      (segments.length === 3 && segments[2] === "execute")
    );
};

const isPracticeShortlistOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  const method = request.method.toUpperCase();
  if (method !== "PUT" && method !== "DELETE") return false;

  const segments = pathSegmentsFor(request);

  return segments !== null && segments.length === 1 && segments[0] === "practice-shortlist";
};

const isLiveDraftRoomOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  const segments = pathSegmentsFor(request);
  if (segments === null || segments[0] !== "live-rooms") return false;

  return segments.length === 1 ||
    (
      segments.length === 3 &&
      liveRoomMutationActions.has(segments[2] ?? "")
    );
};

const isExportArtifactOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  const segments = pathSegmentsFor(request);

  return segments !== null &&
    segments.length === 3 &&
    segments[0] === "live-rooms" &&
    (segments[2] === "export-artifacts" || segments[2] === "export-artifact");
};

const isJobAndSimulationOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  const segments = pathSegmentsFor(request);
  if (segments === null) return false;

  return segments[0] === "jobs" &&
    segments.length === 3 &&
    (segments[2] === "cancel" || segments[2] === "rerun");
};

const isAuthOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    if (segments.length === 1) {
      return segments[0] === "accounts" ||
        segments[0] === "sessions" ||
        segments[0] === "email-verifications" ||
        segments[0] === "password-resets";
    }

    return segments.length === 2 &&
      (segments[0] === "email-verifications" || segments[0] === "password-resets") &&
      segments[1] === "consume";
  } catch {
    return false;
  }
};

const isLeagueSetupOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  const method = request.method.toUpperCase();
  if (method !== "POST" && method !== "PUT") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    if (
      method === "POST" &&
      segments.length === 1 &&
      (segments[0] === "seasons" || segments[0] === "leagues")
    ) return true;
    if (method === "PUT" && segments.length === 2 && segments[0] === "seasons") return true;
    if (
      method === "POST" &&
      segments.length === 3 &&
      segments[0] === "seasons" &&
      segments[2] === "publish"
    ) return true;

    return method === "POST" &&
      segments.length === 4 &&
      segments[0] === "seasons" &&
      segments[2] === "setup-import";
  } catch {
    return false;
  }
};

const isLeagueMembersScreenshotAnalysisRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);

  if (segments === null) return false;

  return (
    segments.length === 4 &&
    segments[0] === "seasons" &&
    segments[2] === "setup-import" &&
    segments[3] === "screenshot-analyze"
  ) || (
    segments.length === 3 &&
    segments[0] === "league-imports" &&
    segments[1] === "espn" &&
    segments[2] === "members-screenshot-review"
  );
};

const isSeasonSimulationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);

  return segments !== null && segments.length === 1 && segments[0] === "season-simulations";
};

const isHistoricalImportOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;

  try {
    const segments = new URL(request.path, "http://mockd.local").pathname
      .split("/")
      .filter(Boolean)
      .map(segment => decodeURIComponent(segment));

    return segments.length === 4 &&
      segments[0] === "seasons" &&
      segments[2] === "historical-imports" &&
      segments[3] === "preview";
  } catch {
    return false;
  }
};

const isTransactionalPostgresClient = (
  client: PostgresQueryClient,
): client is PostgresTransactionalQueryClient =>
  "transaction" in client && typeof client.transaction === "function";

const initializePostgresSchemas = async (
  options: Pick<
    CreatePlatformServerOptions,
    | "initializePostgresSchema"
    | "postgresAuthClient"
    | "postgresClient"
    | "postgresHistoricalImportClient"
    | "postgresLeagueSetupClient"
    | "postgresJobClient"
    | "postgresSimulationClient"
    | "postgresLiveDraftRoomClient"
    | "postgresExportArtifactClient"
  >,
): Promise<void> => {
  if (options.initializePostgresSchema !== true) return;

  const migratedClients = new Set<PostgresTransactionalQueryClient>();
  const candidates = [
    options.postgresClient,
    options.postgresAuthClient,
    options.postgresLeagueSetupClient,
    options.postgresHistoricalImportClient,
    options.postgresJobClient,
    options.postgresSimulationClient,
    options.postgresLiveDraftRoomClient,
    options.postgresExportArtifactClient,
  ];

  for (const client of candidates) {
    if (client === undefined || !isTransactionalPostgresClient(client) || migratedClients.has(client)) continue;

    await applyPlatformPostgresMigrations(client);
    migratedClients.add(client);
  }
};

const snapshotWriteConflictResponse = {
  status: 409,
  body: {
    error: {
      code: "snapshot_write_conflict",
      message: "Stored draft data changed before this request could be saved. Reload and try again.",
    },
  },
} as const;

const isSnapshotWriteConflict = (error: unknown): error is PostgresPlatformStoreError =>
  error instanceof PostgresPlatformStoreError && error.code === "snapshot_write_conflict";

const serializeAsyncOperations = () => {
  let chain = Promise.resolve();

  return async <T>(operation: () => Promise<T>): Promise<T> => {
    const result = chain.then(operation, operation);
    chain = result.then(
      () => undefined,
      () => undefined,
    );

    return result;
  };
};

const closeServer = async (server: Server): Promise<void> => {
  if (!server.listening) return;

  await new Promise<void>((resolve, reject) => {
    server.close(error => {
      if (error === undefined) resolve();
      else reject(error);
    });
  });
};

const loadStore = async (
  options: Pick<
    CreatePlatformServerOptions,
    "dataFilePath" | "initializePostgresSchema" | "now" | "postgresClient" | "postgresSnapshotKey"
  >,
): Promise<{
  store: InMemoryPlatformStore;
  fileStore?: FilePlatformStore | undefined;
  postgresStore?: PostgresPlatformStore | undefined;
}> => {
  if (options.dataFilePath !== undefined && options.postgresClient !== undefined) {
    throw new Error("Configure either dataFilePath or postgresClient, not both.");
  }

  if (options.postgresClient !== undefined) {
    if (
      options.initializePostgresSchema === true &&
      !isTransactionalPostgresClient(options.postgresClient)
    ) {
      await PostgresPlatformStore.initializeSchema(options.postgresClient);
    }

    const postgresStore = await PostgresPlatformStore.load(options.postgresClient, {
      snapshotKey: options.postgresSnapshotKey,
      now: options.now,
    });

    return {
      store: postgresStore.store,
      postgresStore,
    };
  }

  const dataFilePath = options.dataFilePath;
  if (dataFilePath === undefined) {
    return { store: new InMemoryPlatformStore() };
  }

  const fileStore = await FilePlatformStore.load(dataFilePath);

  return {
    store: fileStore.store,
    fileStore,
  };
};

const listen = async (
  server: Server,
  port: number,
  host: string,
): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, resolve);
  });
};

const hostForUrl = (host: string): string => host.includes(":") ? `[${host}]` : host;

export const createPlatformServer = async (
  options: CreatePlatformServerOptions,
): Promise<PlatformServer> => {
  if (
    options.emailVerificationRequired === true &&
    (options.authMailSender === undefined || options.publicBaseUrl === undefined)
  ) {
    throw new Error("Email verification requires an auth mail sender and public base URL.");
  }
  if (options.authRepository !== undefined && options.postgresAuthClient !== undefined) {
    throw new Error("Configure either authRepository or postgresAuthClient, not both.");
  }
  if (options.leagueSetupRepository !== undefined && options.postgresLeagueSetupClient !== undefined) {
    throw new Error("Configure either leagueSetupRepository or postgresLeagueSetupClient, not both.");
  }
  if (options.historicalImportRepository !== undefined && options.postgresHistoricalImportClient !== undefined) {
    throw new Error("Configure either historicalImportRepository or postgresHistoricalImportClient, not both.");
  }
  if (options.jobRepository !== undefined && options.postgresJobClient !== undefined) {
    throw new Error("Configure either jobRepository or postgresJobClient, not both.");
  }
  if (options.simulationRepository !== undefined && options.postgresSimulationClient !== undefined) {
    throw new Error("Configure either simulationRepository or postgresSimulationClient, not both.");
  }
  if (options.liveDraftRoomRepository !== undefined && options.postgresLiveDraftRoomClient !== undefined) {
    throw new Error("Configure either liveDraftRoomRepository or postgresLiveDraftRoomClient, not both.");
  }
  if (options.exportArtifactRepository !== undefined && options.postgresExportArtifactClient !== undefined) {
    throw new Error("Configure either exportArtifactRepository or postgresExportArtifactClient, not both.");
  }

  await initializePostgresSchemas(options);

  interface Runtime {
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
    liveDraftRoomSetupProvider?: ((season: LeagueSeason) => Promise<LiveDraftRoomSetup | null>) | undefined;
    app: PlatformApp;
    platformHandler: PlatformHttpHandler;
    rawJobHandlers: PlatformJobHandlers;
    fileStore?: FilePlatformStore | undefined;
    postgresStore?: PostgresPlatformStore | undefined;
    postgresAuthRepository?: PostgresAuthRepository | undefined;
    postgresLeagueSetupRepository?: PostgresLeagueSetupRepository | undefined;
    postgresHistoricalImportRepository?: PostgresHistoricalImportRepository | undefined;
    postgresJobQueue?: PostgresJobQueue | undefined;
    postgresSimulationRepository?: PostgresSimulationRepository | undefined;
    postgresPracticeShortlistRepository?: PostgresPracticeShortlistRepository | undefined;
    postgresLiveDraftRoomRepository?: PostgresLiveDraftRoomRepository | undefined;
    postgresExportArtifactRepository?: PostgresExportArtifactRepository | undefined;
    postgresInvitationRepository?: PostgresPlatformInvitationRepository | undefined;
    postgresLiveDraftRoomSetupRepository?: PostgresLiveDraftRoomSetupRepository | undefined;
  }

  let runtime: Runtime;
  const accountRateLimiter = options.accountRateLimiter ?? createNormalizedEmailRateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const loginRateLimiter = options.loginRateLimiter ?? createNormalizedEmailRateLimiter({
    maxAttempts: 5,
    windowMs: 15 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const verificationRateLimiter = options.verificationRateLimiter ?? createNormalizedEmailRateLimiter({
    maxAttempts: 3,
    windowMs: 60 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const passwordResetRateLimiter = options.passwordResetRateLimiter ?? createNormalizedEmailRateLimiter({
    maxAttempts: 3,
    windowMs: 60 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const passwordResetConsumeRateLimiter = options.passwordResetConsumeRateLimiter
    ?? createClientAddressRateLimiter({
      maxAttempts: 5,
      windowMs: 15 * 60 * 1_000,
      maxTrackedEmails: 10_000,
    });
  const authClientRateLimiter = options.authClientRateLimiter ?? createClientAddressRateLimiter({
    maxAttempts: 120,
    windowMs: 15 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const screenshotImportRateLimiter = options.screenshotImportRateLimiter ?? createClientAddressRateLimiter({
    maxAttempts: 5,
    windowMs: 60 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const screenshotImportIngressRateLimiter = options.screenshotImportIngressRateLimiter
    ?? createClientAddressRateLimiter({
      maxAttempts: 5,
      windowMs: 60 * 60 * 1_000,
      maxTrackedEmails: 10_000,
    });
  const historicalImportRequestAdmission = createHistoricalImportRequestAdmission({
    accountRateLimiter: options.historicalImportAccountRateLimiter ?? createClientAddressRateLimiter({
      maxAttempts: 30,
      windowMs: 60 * 60 * 1_000,
      maxTrackedEmails: 10_000,
    }),
    clientRateLimiter: options.historicalImportClientRateLimiter ?? createClientAddressRateLimiter({
      maxAttempts: 60,
      windowMs: 60 * 60 * 1_000,
      maxTrackedEmails: 10_000,
    }),
    maxConcurrentPerAccount: options.historicalImportMaxConcurrentPerAccount ?? 2,
    maxConcurrentPerClient: options.historicalImportMaxConcurrentPerClient ?? 4,
  });
  const leagueImportRateLimiter = options.leagueImportRateLimiter ?? createClientAddressRateLimiter({
    maxAttempts: 10,
    windowMs: 15 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const simulationRateLimiter = options.simulationRateLimiter ?? createClientAddressRateLimiter({
    maxAttempts: 10,
    windowMs: 15 * 60 * 1_000,
    maxTrackedEmails: 10_000,
  });
  const liveDraftMutationRateLimiter = options.liveDraftMutationRateLimiter
    ?? createClientAddressRateLimiter({
      maxAttempts: 30,
      windowMs: 60 * 1_000,
      maxTrackedEmails: 10_000,
    });
  const seasonSimulationRunner = options.seasonSimulationRunner ?? createNodeSeasonSimulationRunner();
  let activeSeasonSimulationCapture: (() => void) | undefined;
  const httpSeasonSimulationRunner: SeasonSimulationRunner = (input, runOptions) => {
    activeSeasonSimulationCapture?.();
    return seasonSimulationRunner(input, runOptions);
  };
  const runSerializedForSnapshotStore = serializeAsyncOperations();
  const runInSnapshotCriticalSection = async <T>(operation: () => Promise<T>): Promise<T> =>
    runtime.postgresStore === undefined
      ? operation()
      : runSerializedForSnapshotStore(operation);

  const rawPersist = async (): Promise<void> => {
    try {
      await runtime.fileStore?.save();
      await runtime.postgresStore?.save();
    } catch (error) {
      if (isSnapshotWriteConflict(error) && options.postgresClient !== undefined) {
        runtime = createRuntime(await loadStore({
          postgresClient: options.postgresClient,
          postgresSnapshotKey: options.postgresSnapshotKey,
          now: options.now,
        }));
      }

      throw error;
    }
  };
  const persist = async (): Promise<void> => runInSnapshotCriticalSection(rawPersist);
  const jobHandlers: PlatformJobHandlers = {
    [platformJobTypes.simulationRunExecution]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.simulationRunExecution](payload, context))
      ),
    [platformJobTypes.historicalImportParse]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.historicalImportParse](payload, context))
      ),
    [platformJobTypes.pricingRebuild]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.pricingRebuild](payload, context))
      ),
    [platformJobTypes.draftRoomExport]: (payload, context) =>
      runInSnapshotCriticalSection(() =>
        Promise.resolve(runtime.rawJobHandlers[platformJobTypes.draftRoomExport](payload, context))
      ),
  };

  const createRuntime = ({
    store,
    fileStore,
    postgresStore,
  }: Awaited<ReturnType<typeof loadStore>>): Runtime => {
    const postgresAuthRepository = options.postgresAuthClient === undefined
      ? undefined
      : new PostgresAuthRepository(options.postgresAuthClient);
    const postgresLeagueSetupRepository = options.postgresLeagueSetupClient === undefined
      ? undefined
      : new PostgresLeagueSetupRepository(options.postgresLeagueSetupClient);
    const postgresHistoricalImportRepository = options.postgresHistoricalImportClient === undefined
      ? undefined
      : new PostgresHistoricalImportRepository(options.postgresHistoricalImportClient);
    const postgresJobQueue = options.postgresJobClient === undefined
      ? undefined
      : new PostgresJobQueue(options.postgresJobClient);
    const postgresSimulationRepository = options.postgresSimulationClient === undefined
      ? undefined
      : new PostgresSimulationRepository(options.postgresSimulationClient);
    const postgresPracticeShortlistRepository = options.practiceShortlistRepository !== undefined ||
        options.postgresClient === undefined ||
        !isTransactionalPostgresClient(options.postgresClient)
      ? undefined
      : new PostgresPracticeShortlistRepository(options.postgresClient);
    const postgresLiveDraftRoomClient = options.postgresLiveDraftRoomClient ??
      (
        options.liveDraftRoomRepository === undefined &&
        options.postgresClient !== undefined &&
        isTransactionalPostgresClient(options.postgresClient)
          ? options.postgresClient
          : undefined
      );
    const postgresExportArtifactClient = options.postgresExportArtifactClient ??
      (
        options.exportArtifactRepository === undefined &&
        options.postgresClient !== undefined &&
        isTransactionalPostgresClient(options.postgresClient)
          ? options.postgresClient
          : undefined
      );
    const postgresLiveDraftRoomRepository = postgresLiveDraftRoomClient === undefined
      ? undefined
      : new PostgresLiveDraftRoomRepository(postgresLiveDraftRoomClient);
    const postgresExportArtifactRepository = postgresExportArtifactClient === undefined
      ? undefined
      : new PostgresExportArtifactRepository(postgresExportArtifactClient);
    const postgresInvitationRepository = options.postgresClient === undefined ||
        !isTransactionalPostgresClient(options.postgresClient)
      ? undefined
      : new PostgresPlatformInvitationRepository(options.postgresClient);
    const postgresLiveDraftRoomSetupRepository = options.postgresClient === undefined
      ? undefined
      : new PostgresLiveDraftRoomSetupRepository(options.postgresClient);
    const authRepository = options.authRepository ?? postgresAuthRepository ?? store.authRepository;
    const leagueSetupRepository = options.leagueSetupRepository ?? postgresLeagueSetupRepository ?? store;
    const historicalImportRepository = options.historicalImportRepository ?? postgresHistoricalImportRepository ?? store.historicalImports;
    const jobRepository = options.jobRepository ?? postgresJobQueue ?? store.jobs;
    const simulationRepository = options.simulationRepository ?? postgresSimulationRepository ?? store.simulations;
    const practiceShortlistRepository = options.practiceShortlistRepository ??
      postgresPracticeShortlistRepository ??
      store.practiceShortlists;
    const liveDraftRoomRepository = options.liveDraftRoomRepository ?? postgresLiveDraftRoomRepository ?? store.liveDraftRooms;
    const exportArtifactRepository = options.exportArtifactRepository ?? postgresExportArtifactRepository ?? store.exportArtifacts;
    const invitationRepository = options.invitationRepository ??
      postgresInvitationRepository ??
      new InMemoryPlatformInvitationRepository();
    const onboardingRepository = options.onboardingRepository ??
      (options.postgresClient === undefined
        ? new InMemoryPlatformOnboardingRepository(() => store.snapshot())
        : new PostgresPlatformOnboardingRepository(options.postgresClient));
    const liveDraftRoomSetupRepository = options.liveDraftRoomSetupRepository ??
      postgresLiveDraftRoomSetupRepository ??
      store.liveDraftRoomSetups;
    const liveDraftRoomSetupProvider = async (season: LeagueSeason): Promise<LiveDraftRoomSetup | null> => {
      const storedSetup = await liveDraftRoomSetupRepository.findForSeason(season.id);
      if (storedSetup !== null) return storedSetup;
      const configuredSetup = await options.liveDraftRoomSetupProvider?.(season) ?? null;
      if (configuredSetup !== null) return configuredSetup;
      if (options.currentPlayerCatalogProvider === undefined) return null;
      const input = {
        seasonId: season.id,
        sourceVersion: `current-catalog-${season.seasonYear}`,
        playerCatalog: await options.currentPlayerCatalogProvider(),
        initialRosters: [],
      };
      return {
        ...input,
        contentHash: liveDraftRoomSetupContentHash(input),
        updatedAt: options.now?.() ?? new Date(),
      };
    };

    if (authRepository !== store.authRepository) {
      store.clearAuthSnapshotState();
    }
    if (historicalImportRepository !== store.historicalImports) {
      store.clearHistoricalImportSnapshotState();
    }

    const app = createPlatformApp({
      store,
      authRepository,
      authEmail: {
        verificationRequired: options.emailVerificationRequired ?? false,
        ...(options.authMailSender === undefined ? {} : { mailSender: options.authMailSender }),
        ...(options.publicBaseUrl === undefined ? {} : { publicBaseUrl: options.publicBaseUrl }),
      },
      leagueSetupRepository,
      historicalImportRepository,
      jobRepository,
      simulationRepository,
      practiceShortlistRepository,
      liveDraftRoomRepository,
      exportArtifactRepository,
      simulationRunner: options.simulationRunner,
    });
    const applyAcceptedMembership = invitationRepository === postgresInvitationRepository
      ? undefined
      : async (
          result: AcceptedPlatformInvitation,
        ): Promise<void> => {
          const season = await leagueSetupRepository.findLeagueSeason(result.invitation.seasonId);
          if (season === null) {
            throw new Error("The invited league season no longer exists.");
          }
          const memberships = await leagueSetupRepository.membershipsForLeague(season.leagueId);
          const updatedMemberships = [
            ...memberships.filter(candidate => candidate.userId !== result.membership.userId),
            result.membership,
          ];
          await leagueSetupRepository.registerLeagueSeason({
            season,
            memberships: updatedMemberships,
            createdByUserId: result.invitation.id,
          });
          if (leagueSetupRepository !== store) {
            store.registerLeagueSeason({
              season,
              memberships: updatedMemberships,
              createdByUserId: result.invitation.id,
            });
          }
        };

    return {
      store,
      app,
      platformHandler: createPlatformHttpHandler(app, {
        invitationRepository,
        leagueSetupRepository,
        onboardingRepository,
        ...(options.currentPlayerCatalogProvider === undefined
          ? {}
          : { currentPlayerCatalogProvider: options.currentPlayerCatalogProvider }),
        ...(options.espnLeagueSettingsImporter === undefined
          ? {}
          : { espnLeagueSettingsImporter: options.espnLeagueSettingsImporter }),
        liveDraftRoomSetupProvider,
        liveDraftRoomSetupRepository,
        ...(options.postDraftProjectionProvider === undefined
          ? {}
          : { postDraftProjectionProvider: options.postDraftProjectionProvider }),
        ...(options.provisioningToken === undefined ? {} : { provisioningToken: options.provisioningToken }),
        ...(options.invitationTokenSecret === undefined
          ? {}
          : { invitationTokenSecret: options.invitationTokenSecret }),
        ...(options.allowPublicSignup === undefined ? {} : { allowPublicSignup: options.allowPublicSignup }),
        ...(options.emailVerificationRequired === undefined
          ? {}
          : { emailVerificationRequired: options.emailVerificationRequired }),
        accountRateLimiter,
        loginRateLimiter,
        verificationRateLimiter,
        passwordResetRateLimiter,
        passwordResetConsumeRateLimiter,
        authClientRateLimiter,
        screenshotImportRateLimiter,
        leagueImportRateLimiter,
        simulationRateLimiter,
        liveDraftMutationRateLimiter,
        seasonSimulationRunner: httpSeasonSimulationRunner,
        ...(options.leagueMembersScreenshotAnalyzer === undefined
          ? {}
          : { leagueMembersScreenshotAnalyzer: options.leagueMembersScreenshotAnalyzer }),
        ...(applyAcceptedMembership === undefined ? {} : { applyAcceptedMembership }),
        ...(options.readinessProbe === undefined ? {} : { readinessProbe: options.readinessProbe }),
      }),
      rawJobHandlers: createPlatformJobHandlers({
        app,
        persist: simulationRepository === store.simulations ? rawPersist : undefined,
      }),
      authRepository,
      leagueSetupRepository,
      historicalImportRepository,
      jobRepository,
      simulationRepository,
      practiceShortlistRepository,
      liveDraftRoomRepository,
      exportArtifactRepository,
      invitationRepository,
      onboardingRepository,
      ...(liveDraftRoomSetupRepository === undefined ? {} : { liveDraftRoomSetupRepository }),
      ...(liveDraftRoomSetupProvider === undefined ? {} : { liveDraftRoomSetupProvider }),
      ...(fileStore === undefined ? {} : { fileStore }),
      ...(postgresStore === undefined ? {} : { postgresStore }),
      ...(postgresAuthRepository === undefined ? {} : { postgresAuthRepository }),
      ...(postgresLeagueSetupRepository === undefined ? {} : { postgresLeagueSetupRepository }),
      ...(postgresHistoricalImportRepository === undefined ? {} : { postgresHistoricalImportRepository }),
      ...(postgresJobQueue === undefined ? {} : { postgresJobQueue }),
      ...(postgresSimulationRepository === undefined ? {} : { postgresSimulationRepository }),
      ...(postgresPracticeShortlistRepository === undefined
        ? {}
        : { postgresPracticeShortlistRepository }),
      ...(postgresLiveDraftRoomRepository === undefined ? {} : { postgresLiveDraftRoomRepository }),
      ...(postgresExportArtifactRepository === undefined ? {} : { postgresExportArtifactRepository }),
      ...(postgresInvitationRepository === undefined ? {} : { postgresInvitationRepository }),
      ...(postgresLiveDraftRoomSetupRepository === undefined
        ? {}
        : { postgresLiveDraftRoomSetupRepository }),
    };
  };

  runtime = createRuntime(await loadStore(options));
  const liveDraftRoomNotifier = new LiveDraftRoomRevisionNotifier({
    maxConcurrentWaitersPerAccount:
      options.liveDraftRoomEventStreamMaxConnectionsPerAccount,
    maxConcurrentWaiters: options.liveDraftRoomEventStreamMaxConnections,
    retryAfterSeconds: options.liveDraftRoomEventStreamRetryAfterSeconds,
  });

  const runRequest = async (
    requestWithNow: PlatformHttpRequest,
  ): Promise<Awaited<ReturnType<PlatformHttpHandler>>> => {
    const response = await runtime.platformHandler(requestWithNow);
    const usesExternalAuthRepository = runtime.authRepository !== runtime.store.authRepository;
    const usesExternalLeagueSetupRepository = runtime.leagueSetupRepository !== runtime.store;
    const usesExternalHistoricalImportRepository = runtime.historicalImportRepository !== runtime.store.historicalImports;
    const usesExternalJobRepository = runtime.jobRepository !== runtime.store.jobs;
    const usesExternalSimulationRepository = runtime.simulationRepository !== runtime.store.simulations;
    const usesExternalPracticeShortlistRepository =
      runtime.practiceShortlistRepository !== runtime.store.practiceShortlists;
    const usesExternalLiveDraftRoomRepository = runtime.liveDraftRoomRepository !== runtime.store.liveDraftRooms;
    const usesExternalExportArtifactRepository = runtime.exportArtifactRepository !== runtime.store.exportArtifacts;
    const skipSnapshotPersist =
      isLeagueMembersScreenshotAnalysisRequest(requestWithNow) ||
      isSeasonSimulationRequest(requestWithNow) ||
      (
        usesExternalAuthRepository &&
        isAuthOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalLeagueSetupRepository &&
        isLeagueSetupOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalHistoricalImportRepository &&
        isHistoricalImportOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalJobRepository &&
        isJobOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalSimulationRepository &&
        isSimulationOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalPracticeShortlistRepository &&
        isPracticeShortlistOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalJobRepository &&
        usesExternalSimulationRepository &&
        isJobAndSimulationOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalLiveDraftRoomRepository &&
        isLiveDraftRoomOnlyMutationRequest(requestWithNow)
      ) ||
      (
        usesExternalExportArtifactRepository &&
        isExportArtifactOnlyMutationRequest(requestWithNow)
      );

    if (
      shouldPersistAfter(requestWithNow, response.status) &&
      !skipSnapshotPersist
    ) {
      try {
        await rawPersist();
      } catch (error) {
        if (isSnapshotWriteConflict(error)) return snapshotWriteConflictResponse;

        throw error;
      }
    }

    return response;
  };

  const handler: PlatformHttpHandler = async request => {
    const requestWithNow = withTrustedNow(request, options.now);
    if (isLeagueMembersScreenshotAnalysisRequest(requestWithNow)) {
      return await runRequest(requestWithNow);
    }
    if (isSeasonSimulationRequest(requestWithNow)) {
      let markCaptured!: () => void;
      const captured = new Promise<void>(resolve => {
        markCaptured = resolve;
      });
      const prepared = await runInSnapshotCriticalSection(async () => {
        activeSeasonSimulationCapture = markCaptured;
        const response = runRequest(requestWithNow);
        try {
          await Promise.race([captured, response.then(() => undefined)]);
        } finally {
          activeSeasonSimulationCapture = undefined;
        }

        return { response };
      });

      const response = await prepared.response;
      if (
        runtime.simulationRepository === runtime.store.simulations
        && shouldPersistAfter(requestWithNow, response.status)
      ) {
        await persist();
      }
      return response;
    }
    const eventStreamRequest = liveDraftRoomEventStreamRequestFor(requestWithNow);
    if (eventStreamRequest !== null) {
      const initialResponse = await runInSnapshotCriticalSection(() => runRequest(requestWithNow));
      if (!isKeepAliveEventStreamResponse(initialResponse)) return initialResponse;

      const account = await runtime.app.findAccountBySessionToken(
        requestWithNow.sessionToken ?? "",
        requestWithNow.now,
      );
      if (account === null) {
        return {
          status: 401,
          body: {
            error: {
              code: "auth_required",
              message: "Sign in before using this workspace.",
            },
          },
        };
      }

      try {
        await liveDraftRoomNotifier.waitForRevision({
          ...eventStreamRequest,
          accountId: account.id,
          signal: requestWithNow.signal,
        });
      } catch (error) {
        if (!(error instanceof LiveDraftRoomWaitLimitError)) throw error;

        return {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds) },
          body: {
            error: {
              code: "live_draft_event_stream_limit",
              message: "Too many live draft connections. Try again shortly.",
            },
          },
        };
      }

      if (requestWithNow.signal?.aborted === true) return initialResponse;

      return await runInSnapshotCriticalSection(() => runRequest(requestWithNow));
    }

    const runSerializedRequest = () => runInSnapshotCriticalSection(() => runRequest(requestWithNow));
    const draftMutationSeasonId = await draftMutationSeasonIdFor(
      requestWithNow,
      runtime.liveDraftRoomRepository,
    );
    const postgresClient = options.postgresClient;
    if (
      draftMutationSeasonId !== null &&
      postgresClient !== undefined &&
      isTransactionalPostgresClient(postgresClient)
    ) {
      return await runInSnapshotCriticalSection(async () => {
        let response: PlatformHttpResponse;
        try {
          response = await postgresClient.transaction(async client => {
            await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [
              `mockd:draft-mutation:${draftMutationSeasonId}`,
            ]);
            const transactionalResponse = await runRequest(requestWithNow);
            if (transactionalResponse.status >= 400) {
              throw new DraftMutationResponseRollback(transactionalResponse);
            }

            return transactionalResponse;
          });
        } catch (error) {
          runtime = createRuntime(await loadStore({
            postgresClient,
            postgresSnapshotKey: options.postgresSnapshotKey,
            now: options.now,
          }));
          if (error instanceof DraftMutationResponseRollback) {
            response = error.response;
          } else {
            throw error;
          }
        }
        notifyLiveDraftRoomRevision(liveDraftRoomNotifier, requestWithNow, response);

        return response;
      });
    }

    const response = await runSerializedRequest();
    notifyLiveDraftRoomRevision(liveDraftRoomNotifier, requestWithNow, response);

    return response;
  };
  const draftToolsAdapter = createPlatformDraftToolsAdapter({
    authorizeSeason: async (account, seasonId) => {
      const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
      if (season === null) return false;

      return await runtime.leagueSetupRepository.findMembership(account.id, season.leagueId) !== null;
    },
    baseSessionDirectory: options.draftToolsSessionDirectory ?? "data/platform-draft-tools",
    importMaxBodyBytes: options.screenshotImportBodyLimitBytes,
    legacyMockBatchEnabled: options.legacyMockBatchEnabled ?? false,
    maxBodyBytes: options.bodyLimitBytes,
    resolveSeasonOptions: async seasonId => {
      const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
      if (season === null) return null;
      const setup = await runtime.liveDraftRoomSetupProvider?.(season) ?? null;
      if (setup === null) return null;

      return await buildSeasonDraftToolsOptions(season, setup);
    },
    resolveAccount: async request => {
      const sessionToken = platformSessionTokenForHeaders(request.headers);
      if (sessionToken === undefined) return null;

      return await runtime.app.findAccountBySessionToken(sessionToken, options.now?.());
    },
  });
  const platformNodeHandler = createPlatformNodeHttpAdapter(handler, {
    appHtml: createPlatformShellHtml(options.shellCapabilities ?? {
      leagueCreationScreenshotAnalysis: false,
    }),
    draftRoomHtml: platformHostedDraftRoomHtml,
    maxBodyBytes: options.bodyLimitBytes,
    screenshotImportMaxBodyBytes: options.screenshotImportBodyLimitBytes,
    screenshotImportPreflight: async request => {
      const segments = pathSegmentsFor(request);
      const sessionToken = request.sessionToken;
      const account = sessionToken === undefined
        ? null
        : await runtime.app.findAccountBySessionToken(sessionToken, options.now?.());
      if (account === null) {
        return {
          status: 401,
          body: {
            error: {
              code: "auth_required",
              message: "Sign in before using this workspace.",
            },
          },
        };
      }

      const isLeagueCreationScreenshot = segments?.length === 3 &&
        segments[0] === "league-imports" &&
        segments[1] === "espn" &&
        segments[2] === "members-screenshot-review";
      if (isLeagueCreationScreenshot) {
        const ingressKey = `${account.id}:league-create:${request.clientAddress ?? "unknown"}`;
        const decision = screenshotImportIngressRateLimiter.consume(ingressKey, options.now?.());
        if (!decision.allowed) {
          return {
            status: 429,
            headers: {
              "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))),
            },
            body: {
              error: {
                code: "rate_limited",
                message: "Too many screenshot analyses. Try again later.",
              },
            },
          };
        }
        return null;
      }

      const seasonId = segments?.[1] ?? "";

      const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
      if (season === null) {
        return {
          status: 404,
          body: {
            error: {
              code: "season_not_found",
              message: "League season was not found.",
            },
          },
        };
      }

      const membership = await runtime.leagueSetupRepository.findMembership(
        account.id,
        season.leagueId,
      );
      if (membership?.role !== "owner" && membership?.role !== "admin") {
        return {
          status: 403,
          body: {
            error: {
              code: "shared_mutation_denied",
              message: "Only league owners and admins can manage league setup.",
            },
          },
        };
      }

      const ingressKey = `${account.id}:${seasonId}:${request.clientAddress ?? "unknown"}`;
      const decision = screenshotImportIngressRateLimiter.consume(ingressKey, options.now?.());
      if (!decision.allowed) {
        return {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))),
          },
          body: {
            error: {
              code: "rate_limited",
              message: "Too many screenshot analyses. Try again later.",
            },
          },
        };
      }

      return null;
    },
    historicalImportPreflight: async request => {
      const segments = pathSegmentsFor(request);
      const sessionToken = request.sessionToken;
      const account = sessionToken === undefined
        ? null
        : await runtime.app.findAccountBySessionToken(sessionToken, options.now?.());
      if (account === null) {
        return {
          status: 401,
          body: {
            error: {
              code: "auth_required",
              message: "Sign in before using this workspace.",
            },
          },
        };
      }

      const seasonId = segments?.[1] ?? "";
      const season = await runtime.leagueSetupRepository.findLeagueSeason(seasonId);
      if (season === null) {
        return {
          status: 404,
          body: {
            error: {
              code: "season_not_found",
              message: "League season was not found.",
            },
          },
        };
      }

      const membership = await runtime.leagueSetupRepository.findMembership(
        account.id,
        season.leagueId,
      );
      if (membership?.role !== "owner" && membership?.role !== "admin") {
        return {
          status: 403,
          body: {
            error: {
              code: "shared_mutation_denied",
              message: "Only league owners and admins can manage league setup.",
            },
          },
        };
      }

      const decision = historicalImportRequestAdmission.acquire({
        accountId: account.id,
        clientAddress: request.clientAddress ?? "unknown",
        now: options.now?.(),
      });
      if (!decision.allowed) {
        const concurrencyLimited = decision.reason === "concurrency_limited";
        return {
          status: 429,
          headers: {
            "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))),
          },
          body: {
            error: {
              code: concurrencyLimited ? "historical_import_busy" : "rate_limited",
              message: concurrencyLimited
                ? "Another historical draft import is already being processed. Try again in a moment."
                : "Too many historical draft imports. Try again later.",
            },
          },
        };
      }

      return decision.permit;
    },
    trustProxy: options.trustProxy,
  });
  const server = createServer(async (request, response) => {
    if (await draftToolsAdapter(request, response)) return;

    await platformNodeHandler(request, response);
  });
  const platformServer = {
    server,
    get app() {
      return runtime.app;
    },
    get store() {
      return runtime.store;
    },
    get authRepository() {
      return runtime.authRepository;
    },
    get leagueSetupRepository() {
      return runtime.leagueSetupRepository;
    },
    get historicalImportRepository() {
      return runtime.historicalImportRepository;
    },
    get jobRepository() {
      return runtime.jobRepository;
    },
    get simulationRepository() {
      return runtime.simulationRepository;
    },
    get practiceShortlistRepository() {
      return runtime.practiceShortlistRepository;
    },
    get liveDraftRoomRepository() {
      return runtime.liveDraftRoomRepository;
    },
    get exportArtifactRepository() {
      return runtime.exportArtifactRepository;
    },
    get invitationRepository() {
      return runtime.invitationRepository;
    },
    get onboardingRepository() {
      return runtime.onboardingRepository;
    },
    get liveDraftRoomSetupRepository() {
      return runtime.liveDraftRoomSetupRepository;
    },
    handler,
    draftToolsAdapter,
    get jobHandlers() {
      return jobHandlers;
    },
    persist,
    close: async () => {
      await closeServer(server);
      await draftToolsAdapter.close();
    },
    get fileStore() {
      return runtime.fileStore;
    },
    get postgresStore() {
      return runtime.postgresStore;
    },
    get postgresAuthRepository() {
      return runtime.postgresAuthRepository;
    },
    get postgresLeagueSetupRepository() {
      return runtime.postgresLeagueSetupRepository;
    },
    get postgresHistoricalImportRepository() {
      return runtime.postgresHistoricalImportRepository;
    },
    get postgresJobQueue() {
      return runtime.postgresJobQueue;
    },
    get postgresSimulationRepository() {
      return runtime.postgresSimulationRepository;
    },
    get postgresLiveDraftRoomRepository() {
      return runtime.postgresLiveDraftRoomRepository;
    },
    get postgresExportArtifactRepository() {
      return runtime.postgresExportArtifactRepository;
    },
    get postgresInvitationRepository() {
      return runtime.postgresInvitationRepository;
    },
    get postgresLiveDraftRoomSetupRepository() {
      return runtime.postgresLiveDraftRoomSetupRepository;
    },
  };

  return platformServer;
};

export const startPlatformServer = async (
  options: StartPlatformServerOptions,
): Promise<StartedPlatformServer> => {
  const { host = "127.0.0.1", port = 0, ...serverOptions } = options;
  const platformServer = await createPlatformServer(serverOptions);

  await listen(platformServer.server, port, host);

  const address = platformServer.server.address();
  if (typeof address !== "object" || address === null) {
    throw new Error("Expected platform server to listen on a TCP address.");
  }

  const startedPort = address.port;

  return {
    server: platformServer.server,
    get app() {
      return platformServer.app;
    },
    get store() {
      return platformServer.store;
    },
    get authRepository() {
      return platformServer.authRepository;
    },
    get leagueSetupRepository() {
      return platformServer.leagueSetupRepository;
    },
    get historicalImportRepository() {
      return platformServer.historicalImportRepository;
    },
    get jobRepository() {
      return platformServer.jobRepository;
    },
    get simulationRepository() {
      return platformServer.simulationRepository;
    },
    get practiceShortlistRepository() {
      return platformServer.practiceShortlistRepository;
    },
    get liveDraftRoomRepository() {
      return platformServer.liveDraftRoomRepository;
    },
    get exportArtifactRepository() {
      return platformServer.exportArtifactRepository;
    },
    get invitationRepository() {
      return platformServer.invitationRepository;
    },
    get onboardingRepository() {
      return platformServer.onboardingRepository;
    },
    get liveDraftRoomSetupRepository() {
      return platformServer.liveDraftRoomSetupRepository;
    },
    handler: platformServer.handler,
    get draftToolsAdapter() {
      return platformServer.draftToolsAdapter;
    },
    get jobHandlers() {
      return platformServer.jobHandlers;
    },
    get fileStore() {
      return platformServer.fileStore;
    },
    get postgresStore() {
      return platformServer.postgresStore;
    },
    get postgresAuthRepository() {
      return platformServer.postgresAuthRepository;
    },
    get postgresLeagueSetupRepository() {
      return platformServer.postgresLeagueSetupRepository;
    },
    get postgresHistoricalImportRepository() {
      return platformServer.postgresHistoricalImportRepository;
    },
    get postgresJobQueue() {
      return platformServer.postgresJobQueue;
    },
    get postgresSimulationRepository() {
      return platformServer.postgresSimulationRepository;
    },
    get postgresLiveDraftRoomRepository() {
      return platformServer.postgresLiveDraftRoomRepository;
    },
    get postgresExportArtifactRepository() {
      return platformServer.postgresExportArtifactRepository;
    },
    persist: platformServer.persist,
    close: platformServer.close,
    host,
    port: startedPort,
    url: `http://${hostForUrl(host)}:${startedPort}`,
  };
};
