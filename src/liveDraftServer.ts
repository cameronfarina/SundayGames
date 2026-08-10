import http, { type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { keepers } from "../config/keepers.js";
import { leagueConfig, ownerOrder, type Position } from "../config/league.js";
import { nflTeamByEspnProTeamId } from "../config/nflTeams.js";
import {
  defaultDraftRoomRankingPath,
  loadDraftRoomRankings,
  type DraftRoomRanking,
} from "./data/draftRoomRankings.js";
import { normalizePlayerName } from "./data/normalizePlayerName.js";
import {
  loadHistoricalAuctionRecords,
  type HistoricalAuctionRecord,
} from "./data/parseHistoricalBoards.js";
import { loadPlayerEvidenceSourceRows } from "./data/playerEvidenceSourceAdapters.js";
import {
  fetchRotowireRssNews,
  type RawPlayerNewsItem,
} from "./data/playerNewsProviderAdapters.js";
import {
  FileBackedLiveDraftSessionStore,
  liveDraftCommandsCsv,
  liveDraftCommandsJson,
  parseLiveDraftCommandImport,
  type LiveDraftCommandImportFormat,
  type LiveDraftSessionStatus,
} from "./liveDraftSessionStore.js";
import { liveDraftHtml } from "./liveDraftUi.js";
import {
  buildLiveDraftState,
  type LiveDraftRosterPlayer,
  type LiveDraftReadiness,
  type LiveDraftReadinessCheck,
  type LiveDraftReadinessStatus,
  type LiveDraftSaleMockRange,
  type LiveDraftState,
  type LiveDraftTarget,
} from "./modeling/liveDraft.js";
import { strategyAuctionOverridesFor } from "./modeling/interactiveMockDraft.js";
import {
  defaultLiveDraftStrategyKey,
  liveDraftStrategyFor,
  parseLiveDraftStrategyKey,
  type LiveDraftStrategyKey,
} from "./modeling/liveDraftStrategies.js";
import {
  buildMyExpertAdvice,
  type MyExpertAdviceCard,
  type MyExpertPlayer,
} from "./modeling/myExpert.js";
import {
  leagueSyncProviderStatuses,
  leagueSyncReadOnlyPolicy,
  yahooFantasyReadScope,
  yahooOAuthAuthorizeUrl,
  yahooTokenEndpoint,
  type LeagueSyncProviderStatusReport,
} from "./modeling/leagueSync.js";
import {
  runMockBatch,
  runMockBatchProgressively,
  summarizeMockBatch,
  type ForcedAuctionSale,
  type MockBatch,
  type RunMockBatchOptions,
} from "./modeling/mockBatch.js";
import type { AuctionEngineConfigOverrides, OwnerPlayerTargetMaxBids } from "./modeling/auctionEngine.js";
import { buildMockResultsReport, type MockResultsReport } from "./modeling/mockResults.js";
import {
  canonicalizeMockDraftScript,
  parseMockDraftScript,
  type MockDraftScript,
} from "./modeling/mockScript.js";
import { buildPricingConfigFromSources } from "./pricingConfig.js";
import {
  buildPlayerNewsFeed,
  type PlayerNewsFeed,
  type PlayerNewsFilters,
  type PlayerNewsPlayerMetadata,
  type PlayerNewsSourceMode,
} from "./modeling/playerNews.js";
import { loadEspnWeeksOneToFour, type ProjectionRecord } from "./projections.js";
import type { PricingConfig } from "./modeling/basePricing.js";

const projectionPath = "data/raw/espn-projections-2026-weeks-1-4.json";
const playerNewsEvidencePath = "data/raw/player-evidence-2026-initial.csv";
const defaultPort = 4317;
const liveTargetLimit = 500;
const defaultLiveDraftSessionMode = "real";
const defaultLiveDraftSessionKey = "live";
const defaultLiveDraftSessionDirectory = "data/live-draft";
const interactiveMockSessionDirectoryName = "interactive-mock";
const maximumBatchRunsPerScenario = 250;

export type LiveDraftSessionMode = "real" | "interactive-mock";

interface LiveDraftSessionDescriptor {
  key: string;
  label: string;
  description: string;
}

interface LiveDraftModeDescriptor {
  key: LiveDraftSessionMode;
  label: string;
  description: string;
}

interface DraftNightLockStatus {
  locked: boolean;
  reason?: string;
}

const liveDraftNightLockReason =
  "Live session is locked for mock draft advances. Switch to a practice session to run interactive mocks.";

const draftNightLockFor = (draftSessionKey: string): DraftNightLockStatus =>
  draftSessionKey === defaultLiveDraftSessionKey
    ? { locked: true, reason: liveDraftNightLockReason }
    : { locked: false };

const isProtectedLiveDraftMutation = (draftSessionKey: string, mode: LiveDraftSessionMode): boolean =>
  draftSessionKey === defaultLiveDraftSessionKey && mode === "real";

const liveDraftModes: readonly LiveDraftModeDescriptor[] = [
  {
    key: "real",
    label: "Real draft",
    description: "Draft-night logger. Writes to the real live-draft files.",
  },
  {
    key: "interactive-mock",
    label: "Mock draft",
    description: "Practice room. Cam controls Cam while AI owners bid and nominate.",
  },
];

const presetDraftSessions: readonly LiveDraftSessionDescriptor[] = [
  {
    key: "live",
    label: "Live",
    description: "Draft-night room. Writes to the main live-draft files.",
  },
  {
    key: "practice-3rb",
    label: "Practice 3RB",
    description: "Practice room for true-three-RB prep.",
  },
  {
    key: "practice-wr-heavy",
    label: "Practice WR Heavy",
    description: "Practice room for receiver-heavy builds.",
  },
];

const optionValue = (name: string): string | undefined => {
  const option = process.argv.find(arg => arg.startsWith(`${name}=`));
  return option?.slice(name.length + 1);
};

const portFromOptions = (): number => {
  const value = optionValue("--port") ?? process.env.PORT;
  if (!value) return defaultPort;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("--port must be a positive integer.");
  return parsed;
};

const sessionDirectoryFromOptions = (): string | undefined =>
  optionValue("--session-dir") ?? process.env.MOCKD_LIVE_DRAFT_DIR;

const readRequestBody = async (request: IncomingMessage): Promise<string> =>
  new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", chunk => {
      body += chunk;
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });

const sendJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  response.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(JSON.stringify(body));
};

const sendText = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: string,
): void => {
  response.writeHead(statusCode, {
    "content-type": `${contentType}; charset=utf-8`,
    "cache-control": "no-store",
  });
  response.end(body);
};

const sendHtml = (response: ServerResponse): void => {
  response.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  response.end(liveDraftHtml);
};

interface YahooOAuthState {
  provider: "yahoo";
  createdAt: string;
  redirectUri: string;
}

const yahooOAuthStates = new Map<string, YahooOAuthState>();

const requestOriginFor = (request: IncomingMessage): string => {
  const forwardedProto = Array.isArray(request.headers["x-forwarded-proto"])
    ? request.headers["x-forwarded-proto"][0]
    : request.headers["x-forwarded-proto"];
  const protocol = forwardedProto || "http";
  return `${protocol}://${request.headers.host ?? `127.0.0.1:${defaultPort}`}`;
};

const yahooRedirectUriFor = (request: IncomingMessage): string =>
  process.env.MOCKD_YAHOO_REDIRECT_URI?.trim() ||
  `${requestOriginFor(request)}/api/sync/oauth/yahoo/callback`;

const missingEnvFor = (keys: readonly string[]): string[] =>
  keys.filter(key => !process.env[key]?.trim());

const yahooProviderStatus = (): LeagueSyncProviderStatusReport => {
  const provider = leagueSyncProviderStatuses().find(item => item.key === "yahoo");
  if (!provider) throw new Error("Yahoo sync provider is not configured.");
  return provider;
};

const yahooOAuthStartResponse = (request: IncomingMessage): unknown => {
  const provider = yahooProviderStatus();
  const requiredEnv = provider.auth.requiredEnv;
  const missingEnv = missingEnvFor(requiredEnv);
  if (missingEnv.length > 0) {
    return {
      provider: "yahoo",
      readOnly: true,
      error: `Missing ${missingEnv.join(", ")} for Yahoo OAuth.`,
      requiredEnv,
      setupSteps: provider.setupSteps,
    };
  }

  const redirectUri = yahooRedirectUriFor(request);
  const state = randomUUID();
  yahooOAuthStates.set(state, {
    provider: "yahoo",
    createdAt: new Date().toISOString(),
    redirectUri,
  });

  return {
    provider: "yahoo",
    readOnly: true,
    authorizationUrl: yahooOAuthAuthorizeUrl({
      clientId: process.env.MOCKD_YAHOO_CLIENT_ID?.trim() ?? "",
      redirectUri,
      state,
    }),
    redirectUri,
    state,
    scope: yahooFantasyReadScope,
  };
};

const yahooOAuthCallbackResponse = (url: URL): { statusCode: number; body: unknown } => {
  const providerError = url.searchParams.get("error");
  if (providerError) {
    return {
      statusCode: 400,
      body: {
        provider: "yahoo",
        readOnly: true,
        error: providerError,
        detail: url.searchParams.get("error_description") ?? "Yahoo did not authorize access.",
      },
    };
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) {
    return {
      statusCode: 400,
      body: {
        provider: "yahoo",
        readOnly: true,
        error: "Yahoo OAuth callback requires code and state.",
      },
    };
  }

  const savedState = yahooOAuthStates.get(state);
  if (!savedState) {
    return {
      statusCode: 400,
      body: {
        provider: "yahoo",
        readOnly: true,
        error: "Yahoo OAuth state was not recognized. Start the connect flow again.",
      },
    };
  }
  yahooOAuthStates.delete(state);

  return {
    statusCode: 200,
    body: {
      provider: "yahoo",
      readOnly: true,
      status: "authorization-code-received",
      redirectUri: savedState.redirectUri,
      tokenEndpoint: yahooTokenEndpoint,
      nextStep: "Exchange this code server-side, encrypt refresh/access tokens at rest, then enable read-only Yahoo league sync.",
    },
  };
};

const sleeperApiBaseUrl = "https://api.sleeper.app/v1";

const sleeperStringField = (value: unknown, key: string): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "string" && field.trim() ? field.trim() : undefined;
};

const sleeperNumberField = (value: unknown, key: string): number | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === "number" && Number.isFinite(field) ? field : undefined;
};

const sleeperFetchJson = async (path: string): Promise<unknown> => {
  const response = await fetch(`${sleeperApiBaseUrl}${path}`, {
    headers: {
      accept: "application/json",
    },
  });
  if (response.status === 404) throw new Error("Sleeper could not find that username or league.");
  if (!response.ok) throw new Error(`Sleeper request failed with ${response.status}.`);
  return response.json();
};

const sleeperPreviewLeagueFor = (value: unknown): SleeperSyncPreviewLeague | undefined => {
  const leagueId = sleeperStringField(value, "league_id");
  if (!leagueId) return undefined;

  const name = sleeperStringField(value, "name") ?? leagueId;
  const status = sleeperStringField(value, "status");
  const season = sleeperStringField(value, "season");
  const totalRosters = sleeperNumberField(value, "total_rosters");

  return {
    leagueId,
    name,
    ...(status ? { status } : {}),
    ...(season ? { season } : {}),
    ...(totalRosters === undefined ? {} : { totalRosters }),
  };
};

const sleeperUserPreviewFor = (value: unknown): SleeperSyncPreviewResponse["user"] | undefined => {
  const userId = sleeperStringField(value, "user_id");
  if (!userId) return undefined;

  const username = sleeperStringField(value, "username");
  const displayName = sleeperStringField(value, "display_name");
  return {
    userId,
    ...(username ? { username } : {}),
    ...(displayName ? { displayName } : {}),
  };
};

const sleeperFoundMessage = (leagueCount: number): string =>
  leagueCount === 1 ? "Found 1 Sleeper league." : `Found ${leagueCount} Sleeper leagues.`;

const defaultSleeperSyncPreviewProvider: SleeperSyncPreviewProvider = async ({
  identifier,
  season,
}) => {
  const cleanIdentifier = identifier.trim();
  if (!cleanIdentifier) throw new Error("Sleeper username or league ID is required.");

  if (/^\d{6,}$/.test(cleanIdentifier)) {
    const rawLeague = await sleeperFetchJson(`/league/${encodeURIComponent(cleanIdentifier)}`);
    const league = sleeperPreviewLeagueFor(rawLeague);
    if (!league) throw new Error("Sleeper league response did not include a league ID.");
    return {
      provider: "sleeper",
      readOnly: true,
      identifier: cleanIdentifier,
      season,
      resolvedAs: "league",
      message: `Found ${league.name}.`,
      leagues: [league],
    };
  }

  const rawUser = await sleeperFetchJson(`/user/${encodeURIComponent(cleanIdentifier)}`);
  const user = sleeperUserPreviewFor(rawUser);
  if (!user) throw new Error("Sleeper user response did not include a user ID.");

  const rawLeagues = await sleeperFetchJson(
    `/user/${encodeURIComponent(user.userId)}/leagues/nfl/${encodeURIComponent(season)}`,
  );
  const leagues = Array.isArray(rawLeagues)
    ? rawLeagues
        .map(sleeperPreviewLeagueFor)
        .filter((league): league is SleeperSyncPreviewLeague => Boolean(league))
    : [];

  return {
    provider: "sleeper",
    readOnly: true,
    identifier: cleanIdentifier,
    season,
    resolvedAs: "user",
    user,
    message: leagues.length ? sleeperFoundMessage(leagues.length) : "No Sleeper leagues found for that season.",
    leagues,
  };
};

const readinessStatusFor = (checks: readonly LiveDraftReadinessCheck[]): LiveDraftReadinessStatus => {
  if (checks.some(check => check.status === "fail")) return "fail";
  if (checks.some(check => check.status === "warn")) return "warn";
  return "pass";
};

const readinessWithSession = (
  readiness: LiveDraftReadiness,
  session: LiveDraftSessionStatus,
): LiveDraftReadiness => {
  const checks: LiveDraftReadinessCheck[] = [
    ...readiness.checks,
    {
      key: "session-store",
      label: "Session store",
      status: "pass",
      detail: `${session.commandCount} command${session.commandCount === 1 ? "" : "s"} loaded from disk.`,
    },
    {
      key: "sale-log",
      label: "Sale log",
      status: "pass",
      detail: session.paths.logPath,
    },
    {
      key: "backup-file",
      label: "Backup file",
      status: "pass",
      detail: session.paths.backupPath,
    },
  ];

  return {
    status: readinessStatusFor(checks),
    checks,
  };
};

const importFormatFor = (value: unknown): LiveDraftCommandImportFormat => {
  if (value === "csv") return "csv";
  if (value === "json" || value === undefined) return "json";
  throw new Error("Import format must be json or csv.");
};

const parseJsonBody = async (request: IncomingMessage): Promise<Record<string, unknown>> =>
  JSON.parse(await readRequestBody(request) || "{}") as Record<string, unknown>;

const isMissingFileError = (error: unknown): boolean =>
  error instanceof Error &&
  "code" in error &&
  (error as NodeJS.ErrnoException).code === "ENOENT";

const readTextFileIfPresent = async (path: string): Promise<string> => {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFileError(error)) return "";
    throw error;
  }
};

const readJsonFileIfPresent = async (path: string): Promise<unknown | null> => {
  const content = await readTextFileIfPresent(path);
  return content ? JSON.parse(content) : null;
};

interface LiveDraftStateResponse extends LiveDraftState {
  draftMode: LiveDraftSessionMode;
  draftModes: readonly LiveDraftModeDescriptor[];
  activeDraftSession: LiveDraftSessionDescriptor;
  draftSessions: readonly LiveDraftSessionDescriptor[];
  draftNightLock: DraftNightLockStatus;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
}

interface LiveDraftSessionExportBundle {
  version: 1;
  exportedAt: string;
  activeDraftSession: LiveDraftSessionDescriptor;
  draftMode: LiveDraftSessionMode;
  session: LiveDraftSessionStatus;
  readiness: LiveDraftReadiness;
  currentSnapshot: unknown | null;
  backupSnapshot: unknown | null;
  auditLogJsonl: string;
  commandsJson: string;
  commandsCsv: string;
}

interface MyExpertSourceStatus {
  key: string;
  label: string;
  readOnly: true;
  detail: string;
}

interface MyExpertRecommendation {
  id: string;
  type: MyExpertAdviceCard["type"];
  priority: MyExpertAdviceCard["priority"];
  title: string;
  detail: string;
  players: MyExpertPlayer[];
  suggestedAdds: MyExpertPlayer[];
  suggestedDrops: MyExpertPlayer[];
  reasons: string[];
  actionLabel: string;
  readOnly: true;
  lineup?: MyExpertAdviceCard["lineup"];
}

interface MyExpertTeamSummary {
  owner: "Cam";
  rosteredCount: number;
  rosteredValue: number;
  players: MyExpertPlayer[];
}

interface MyExpertSummary {
  currentWeek: number;
  recommendationCount: number;
  highPriorityCount: number;
}

interface MyExpertResponse {
  mode: "advice-only";
  readOnly: true;
  generatedAt: string;
  source: MyExpertSourceStatus;
  team: MyExpertTeamSummary;
  summary: MyExpertSummary;
  recommendations: MyExpertRecommendation[];
  integrations: LeagueSyncProviderStatusReport[];
  policy: ReturnType<typeof buildMyExpertAdvice>["policy"];
}

type LiveDraftImportConflictType = "ambiguous-player" | "invalid-command" | "invalid-import";

interface LiveDraftImportConflictIssue {
  index: number;
  input: string;
  type: LiveDraftImportConflictType;
  message: string;
  matchOptions: string[];
}

interface LiveDraftImportConflictReview {
  title: string;
  importedCount: number;
  issueCount: number;
  issues: LiveDraftImportConflictIssue[];
}

interface LiveDraftMutationResult {
  status: number;
  body: unknown;
}

interface InteractiveMockResultsPublishResult {
  status: number;
  body: LiveDraftStateResponse & {
    mockDraft: unknown;
    mockBatchJob?: MockBatchJob;
    errors?: { input: string; message: string }[];
  };
}

interface InteractiveMockDraftModule {
  buildInteractiveMockDraftState(options: {
    projections: readonly ProjectionRecord[];
    historicalRecords: readonly HistoricalAuctionRecord[];
    keepers: typeof keepers;
    commands: readonly string[];
    watchOwner: "Cam";
    strategyKey: LiveDraftStrategyKey;
    pricingConfig?: PricingConfig;
    draftRoomRankings?: readonly DraftRoomRanking[];
    seed?: string;
    nominatedPlayer?: string;
    nominatedPrice?: number;
  }): unknown;
  resolveInteractiveMockDraftAction(mockDraft: unknown, action: string): unknown;
}

type MockBatchRunner = (options: RunMockBatchOptions) => MockBatch;
type PlayerNewsProvider = () => Promise<readonly RawPlayerNewsItem[]>;

export interface SleeperSyncPreviewRequest {
  identifier: string;
  season: string;
}

export interface SleeperSyncPreviewLeague {
  leagueId: string;
  name: string;
  status?: string;
  season?: string;
  totalRosters?: number;
}

export interface SleeperSyncPreviewResponse {
  provider: "sleeper";
  readOnly: true;
  identifier: string;
  season: string;
  resolvedAs: "league" | "user";
  message: string;
  leagues: SleeperSyncPreviewLeague[];
  user?: {
    userId: string;
    username?: string;
    displayName?: string;
  };
}

type SleeperSyncPreviewProvider = (
  request: SleeperSyncPreviewRequest,
) => Promise<SleeperSyncPreviewResponse>;

type MockBatchJobStatus = "queued" | "running" | "complete" | "failed";

interface MockBatchJob {
  jobId: string;
  status: MockBatchJobStatus;
  source?: "batch" | "interactive-complete";
  draftSessionKey?: string;
  draftMode?: LiveDraftSessionMode;
  commandCount?: number;
  strategyKey: LiveDraftStrategyKey;
  runStrategyKeys: readonly LiveDraftStrategyKey[];
  script?: MockDraftScript;
  runsPerScenario: number;
  totalRuns: number;
  completedRuns: number;
  percent: number;
  startedAt: string;
  updatedAt: string;
  result?: MockResultsReport;
  error?: string;
}

export interface CreateLiveDraftServerOptions {
  sessionDirectory?: string;
  projections?: readonly ProjectionRecord[];
  historicalRecords?: readonly HistoricalAuctionRecord[];
  draftRoomRankings?: readonly DraftRoomRanking[];
  pricingConfig?: PricingConfig;
  interactiveMockDraft?: InteractiveMockDraftModule;
  mockBatchRunner?: MockBatchRunner;
  playerNewsProvider?: PlayerNewsProvider;
  sleeperSyncPreviewProvider?: SleeperSyncPreviewProvider;
}

export interface LiveDraftServerApp {
  server: http.Server;
}

const interactiveMockDraftModuleSpecifier = "./modeling/interactiveMockDraft.js";

const hasInteractiveMockDraftModule = (value: unknown): value is InteractiveMockDraftModule => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return typeof candidate.buildInteractiveMockDraftState === "function" &&
    typeof candidate.resolveInteractiveMockDraftAction === "function";
};

const loadInteractiveMockDraftModule = async (
  providedModule: InteractiveMockDraftModule | undefined,
): Promise<InteractiveMockDraftModule> => {
  if (providedModule) return providedModule;

  const moduleExports = await import(interactiveMockDraftModuleSpecifier) as unknown;
  if (!hasInteractiveMockDraftModule(moduleExports)) {
    throw new Error("Interactive mock draft module is missing required exports.");
  }

  return moduleExports;
};

const strategyKeyFromQuery = (url: URL): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(url.searchParams.get("strategy") ?? undefined);

const strategyKeyFromBody = (body: Record<string, unknown>): LiveDraftStrategyKey =>
  parseLiveDraftStrategyKey(body.strategyKey);

const currentWeekFromQuery = (url: URL): number => {
  const value = url.searchParams.get("week");
  if (!value) return 1;

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error("Week must be a positive integer.");
  return parsed;
};

const sessionModeFromValue = (
  value: unknown,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode => {
  if (value === undefined || value === null || value === "") return fallback;
  if (value === "real" || value === "interactive-mock") return value;
  throw new Error("Draft mode must be real or interactive-mock.");
};

const sessionModeFromQuery = (
  url: URL,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  sessionModeFromValue(url.searchParams.get("mode"), fallback);

const sessionModeFromBody = (
  body: Record<string, unknown>,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  sessionModeFromValue(body.mode, fallback);

const canonicalSessionModeFor = (
  draftSessionKey: string,
  mode: LiveDraftSessionMode,
): LiveDraftSessionMode =>
  draftSessionKey === defaultLiveDraftSessionKey && mode === "interactive-mock" ? "real" : mode;

const sessionModeFromQueryForSession = (
  url: URL,
  draftSessionKey: string,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  canonicalSessionModeFor(draftSessionKey, sessionModeFromQuery(url, fallback));

const sessionModeFromBodyForSession = (
  body: Record<string, unknown>,
  draftSessionKey: string,
  fallback: LiveDraftSessionMode = defaultLiveDraftSessionMode,
): LiveDraftSessionMode =>
  canonicalSessionModeFor(draftSessionKey, sessionModeFromBody(body, fallback));

const scratchSessionPrefix = "scratch:";

const scratchSlugFromValue = (value: string): string => {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  if (!slug) throw new Error("Scratch session name is required.");
  return slug;
};

const draftSessionKeyFromValue = (
  value: unknown,
  fallback = defaultLiveDraftSessionKey,
): string => {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") throw new Error("Draft session must be a string.");

  const trimmed = value.trim();
  if (presetDraftSessions.some(session => session.key === trimmed)) return trimmed;
  if (trimmed.startsWith(scratchSessionPrefix)) {
    return `${scratchSessionPrefix}${scratchSlugFromValue(trimmed.slice(scratchSessionPrefix.length))}`;
  }

  throw new Error("Draft session must be live, practice-3rb, practice-wr-heavy, or scratch:<name>.");
};

const draftSessionKeyFromQuery = (
  url: URL,
  fallback = defaultLiveDraftSessionKey,
): string =>
  draftSessionKeyFromValue(url.searchParams.get("draftSession") ?? url.searchParams.get("session"), fallback);

const draftSessionKeyFromBody = (
  body: Record<string, unknown>,
  fallback = defaultLiveDraftSessionKey,
): string =>
  draftSessionKeyFromValue(body.draftSession ?? body.sessionKey ?? body.session, fallback);

const myExpertIdFor = (name: string): string =>
  normalizePlayerName(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "player";

const projectedPointsFromWeeks = (weeks1To4: number | undefined, fallback: number): number =>
  Math.max(1, Math.round(((weeks1To4 ?? fallback * 4) / 4 + Number.EPSILON) * 10) / 10);

const projectedPointsFromProjection = (
  projection: ProjectionRecord | undefined,
  currentWeek: number,
  fallback: number,
): number => {
  const weeklyProjection = projection?.weeks[currentWeek] ?? (projection && projection.weeks1To4 > 0 ? projection.weeks1To4 / 4 : undefined);
  return Math.max(1, Math.round(((weeklyProjection ?? fallback) + Number.EPSILON) * 10) / 10);
};

const projectionLookupKeyFor = (name: string, position: Position): string =>
  `${normalizePlayerName(name)}:${position}`;

const projectionLookupFor = (
  projections: readonly ProjectionRecord[],
): ReadonlyMap<string, ProjectionRecord> =>
  new Map(projections.map(projection => [projectionLookupKeyFor(projection.name, projection.position), projection]));

const playerNewsMetadataFor = (
  projections: readonly ProjectionRecord[],
): PlayerNewsPlayerMetadata[] =>
  projections.map(projection => {
    const team = projection.proTeamId === undefined ? undefined : nflTeamByEspnProTeamId[projection.proTeamId];
    return {
      name: projection.name,
      normalizedPlayerName: normalizePlayerName(projection.name),
      position: projection.position,
      ...(team ? { teamAbbreviation: team.abbreviation } : {}),
    };
  });

const rosterRoleByPlayerId = (
  slots: LiveDraftState["watchOwner"]["slots"],
): Map<string, MyExpertPlayer["rosteredRole"]> => {
  const roles = new Map<string, MyExpertPlayer["rosteredRole"]>();
  for (const slot of slots) {
    if (!slot.player) continue;
    roles.set(myExpertIdFor(slot.player.name), slot.slot.startsWith("BENCH") ? "bench" : "starter");
  }
  return roles;
};

const optionalPlayerMetadata = (
  player: Pick<LiveDraftRosterPlayer | LiveDraftTarget, "teamAbbreviation" | "byeWeek">,
): Pick<MyExpertPlayer, "teamAbbreviation" | "byeWeek"> => ({
  ...(player.teamAbbreviation === undefined ? {} : { teamAbbreviation: player.teamAbbreviation }),
  ...(player.byeWeek === undefined ? {} : { byeWeek: player.byeWeek }),
});

const myExpertRosterPlayerFrom = (
  player: LiveDraftRosterPlayer,
  role: MyExpertPlayer["rosteredRole"],
  projection: ProjectionRecord | undefined,
  currentWeek: number,
): MyExpertPlayer => ({
  id: myExpertIdFor(player.name),
  name: player.name,
  position: player.position,
  projectedPoints: projectedPointsFromProjection(projection, currentWeek, player.expectedPrice || player.price),
  rosteredRole: role,
  ...optionalPlayerMetadata(player),
});

const myExpertAvailablePlayerFrom = (target: LiveDraftTarget): MyExpertPlayer => ({
  id: myExpertIdFor(target.name),
  name: target.name,
  position: target.position,
  projectedPoints: projectedPointsFromWeeks(target.weeks1To4, target.liveExpectedPrice),
  signals: {
    opportunityScore: Math.max(0, target.personalValue - target.liveExpectedPrice) / 5,
    trendScore: Math.max(0, target.valueScore) / 10,
  },
  ...optionalPlayerMetadata(target),
});

const myExpertPlayerLookup = (
  roster: readonly MyExpertPlayer[],
  availablePlayers: readonly MyExpertPlayer[],
): Map<string, MyExpertPlayer> =>
  new Map([...roster, ...availablePlayers].map(player => [player.id, player]));

const myExpertRecommendationFrom = ({
  card,
  playersById,
  rosterIds,
}: {
  card: MyExpertAdviceCard;
  playersById: ReadonlyMap<string, MyExpertPlayer>;
  rosterIds: ReadonlySet<string>;
}): MyExpertRecommendation => {
  const players = card.playerIds
    .map(playerId => playersById.get(playerId))
    .filter((player): player is MyExpertPlayer => Boolean(player));
  return {
    id: card.id,
    type: card.type,
    priority: card.priority,
    title: card.title,
    detail: card.summary,
    players,
    suggestedAdds: players.filter(player => !rosterIds.has(player.id)),
    suggestedDrops: card.type === "add-drop" ? players.filter(player => rosterIds.has(player.id)) : [],
    reasons: card.reasons,
    actionLabel: card.action.label,
    readOnly: card.action.readOnly,
    ...(card.lineup ? { lineup: card.lineup } : {}),
  };
};

const draftSessionDirectoryFor = (baseDirectory: string, draftSessionKey: string): string => {
  if (draftSessionKey === defaultLiveDraftSessionKey) return baseDirectory;
  if (draftSessionKey.startsWith(scratchSessionPrefix)) {
    return join(baseDirectory, "scratch", draftSessionKey.slice(scratchSessionPrefix.length));
  }
  return join(baseDirectory, draftSessionKey);
};

const activeDraftSessionDescriptorFor = (draftSessionKey: string): LiveDraftSessionDescriptor => {
  const preset = presetDraftSessions.find(session => session.key === draftSessionKey);
  if (preset) return preset;

  return {
    key: draftSessionKey,
    label: `Scratch: ${draftSessionKey.slice(scratchSessionPrefix.length)}`,
    description: "Custom scratch room. Isolated from live and preset practice rooms.",
  };
};

const draftSessionDescriptorsFor = (draftSessionKey: string): readonly LiveDraftSessionDescriptor[] => {
  const active = activeDraftSessionDescriptorFor(draftSessionKey);
  if (presetDraftSessions.some(session => session.key === active.key)) return presetDraftSessions;
  return [...presetDraftSessions, active];
};

const batchRunsPerScenarioFromValue = (value: unknown): number => {
  const parsed = value === undefined ? 25 : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Mock batch runs must be a positive integer.");
  }
  return Math.min(parsed, maximumBatchRunsPerScenario);
};

const seedPrefixFromValue = (value: unknown): string => {
  if (typeof value !== "string") return "live-ui-batch";
  const seedPrefix = value.trim();
  return seedPrefix || "live-ui-batch";
};

const seedFromValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const seed = value.trim();
  return seed ? seed : undefined;
};

const playerNewsSourceModeFromValue = (value: unknown): PlayerNewsSourceMode => {
  if (value === "local" || value === "rotowire-rss" || value === "all") return value;
  return "all";
};

const playerNewsFiltersFromQuery = (url: URL): PlayerNewsFilters => {
  const query = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category")?.trim();
  const draftAction = url.searchParams.get("action")?.trim();

  return {
    source: playerNewsSourceModeFromValue(url.searchParams.get("source")),
    ...(query ? { query } : {}),
    ...(category ? { category } : {}),
    ...(draftAction ? { draftAction } : {}),
  };
};

const nominatedPlayerFromValue = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const nominatedPlayer = value.trim();
  return nominatedPlayer ? nominatedPlayer : undefined;
};

const nominatedPriceFromValue = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;

  const price = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number(value.trim())
      : Number.NaN;
  if (!Number.isInteger(price) || price <= 0) {
    throw new Error("Nomination price must be a positive whole-dollar amount.");
  }

  return price;
};

const mockDraftScriptFromBody = (body: Record<string, unknown>): MockDraftScript | undefined => {
  const value = body.script ?? body.mockScript;
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error("Mock script must be text.");
  return parseMockDraftScript(value);
};

const targetMaxBidOverridesFor = (
  script: MockDraftScript | undefined,
): AuctionEngineConfigOverrides => {
  if (!script) return {};

  const ownerPlayerTargetMaxBids: OwnerPlayerTargetMaxBids = {};
  for (const target of script.targetMaxBids) {
    ownerPlayerTargetMaxBids[target.owner] = {
      ...(ownerPlayerTargetMaxBids[target.owner] ?? {}),
      [normalizePlayerName(target.player)]: target.maxBid,
    };
  }

  return { ownerPlayerTargetMaxBids };
};

const buildAroundPriceCountFor = (script: MockDraftScript | undefined): number =>
  Math.max(1, script?.buildAround?.prices.length ?? 1);

const buildAroundPriceForRun = (
  script: MockDraftScript | undefined,
  completedRuns: number,
  runsPerPricePoint: number,
): number | undefined => {
  const prices = script?.buildAround?.prices;
  if (!prices?.length) return undefined;
  return prices[Math.min(prices.length - 1, Math.floor(completedRuns / Math.max(1, runsPerPricePoint)))];
};

const forcedSalesForBuildAroundRun = (
  script: MockDraftScript | undefined,
  completedRuns: number,
  runsPerPricePoint: number,
): ForcedAuctionSale[] | undefined => {
  const buildAround = script?.buildAround;
  const price = buildAroundPriceForRun(script, completedRuns, runsPerPricePoint);
  if (!buildAround || price === undefined) return undefined;

  return [{ owner: buildAround.owner, player: buildAround.player, price }];
};

const buildAroundRunLabelsFor = (
  script: MockDraftScript | undefined,
  runsPerPricePoint: number,
  runStrategyKeys: readonly LiveDraftStrategyKey[],
): string[] => {
  const buildAround = script?.buildAround;
  if (!buildAround) return [];

  const shortName = buildAround.player.trim().split(/\s+/).at(-1) ?? buildAround.player;
  let runNumber = 0;
  return buildAround.prices.flatMap(price =>
    Array.from({ length: runsPerPricePoint }, () => {
      runNumber += 1;
      const strategyKey = runStrategyKeys[runNumber - 1];
      const fallbackStrategyKey = strategyKey ?? defaultLiveDraftStrategyKey;
      const strategyLabel = fallbackStrategyKey === "three-rb"
        ? "3RB"
        : liveDraftStrategyFor(fallbackStrategyKey).label;
      return `Run ${runNumber}: ${shortName} $${price} / ${strategyLabel}`;
    }));
};

const mergeOwnerPlayerTargetMaxBids = (
  base: OwnerPlayerTargetMaxBids | undefined,
  overrides: OwnerPlayerTargetMaxBids | undefined,
): OwnerPlayerTargetMaxBids | undefined => {
  if (!base && !overrides) return undefined;

  const merged: OwnerPlayerTargetMaxBids = {};
  for (const owner of ownerOrder) {
    const ownerTargets = {
      ...(base?.[owner] ?? {}),
      ...(overrides?.[owner] ?? {}),
    };
    if (Object.keys(ownerTargets).length > 0) {
      merged[owner] = ownerTargets;
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
};

const mergeAuctionConfigOverrides = (
  base: AuctionEngineConfigOverrides,
  overrides: AuctionEngineConfigOverrides,
): AuctionEngineConfigOverrides => {
  const ownerPlayerTargetMaxBids = mergeOwnerPlayerTargetMaxBids(
    base.ownerPlayerTargetMaxBids,
    overrides.ownerPlayerTargetMaxBids,
  );

  return {
    ...base,
    ...overrides,
    ...(ownerPlayerTargetMaxBids === undefined ? {} : { ownerPlayerTargetMaxBids }),
  };
};

const commandFromInteractiveMockAction = (result: unknown): string => {
  const command = optionalCommandFromInteractiveMockAction(result);
  if (command) return command;

  throw new Error("Interactive mock action did not return a sale command.");
};

const optionalCommandFromInteractiveMockAction = (result: unknown): string | undefined => {
  if (!result || typeof result !== "object") {
    return undefined;
  }

  const command = (result as Record<string, unknown>).command;
  if (typeof command !== "string" || !command.trim()) {
    return undefined;
  }

  return command.trim();
};

const mockDraftFromInteractiveMockAction = (result: unknown): unknown | undefined => {
  if (!result || typeof result !== "object") return undefined;

  const mockDraft = (result as Record<string, unknown>).mockDraft;
  return mockDraft && typeof mockDraft === "object" ? mockDraft : undefined;
};

const mockAuctionFromValue = (value: unknown): unknown | undefined =>
  value && typeof value === "object" ? value : undefined;

const mockAuctionPlayerFromValue = (value: unknown): string | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const player = (value as Record<string, unknown>).player;
  return typeof player === "string" && player.trim() ? player.trim() : undefined;
};

const mockAuctionOpeningBidFromValue = (value: unknown): number | undefined => {
  if (!value || typeof value !== "object") return undefined;
  const openingBid = (value as Record<string, unknown>).openingBid;
  return typeof openingBid === "number" && Number.isInteger(openingBid) && openingBid > 0
    ? openingBid
    : undefined;
};

const mockDraftWithClientAuction = (mockDraft: unknown, mockAuction: unknown | undefined): unknown => {
  if (!mockAuction || !mockDraft || typeof mockDraft !== "object") return mockDraft;

  return {
    ...(mockDraft as Record<string, unknown>),
    auction: mockAuction,
  };
};

const ambiguousPlayerMatchOptionsFor = (message: string): string[] => {
  const matchesText = message.match(/ Matches: (.+)\.$/)?.[1];
  if (!matchesText) return [];
  return matchesText.split(",").map(match => match.trim()).filter(Boolean);
};

const importConflictTypeFor = (message: string): LiveDraftImportConflictType => {
  if (message.startsWith("Ambiguous player")) return "ambiguous-player";
  return "invalid-command";
};

const importConflictReviewFor = (
  commands: readonly string[],
  errors: readonly { input: string; message: string }[],
  title = "Import needs review",
): LiveDraftImportConflictReview => ({
  title,
  importedCount: commands.length,
  issueCount: errors.length,
  issues: errors.map((error, errorIndex) => {
    const commandIndex = commands.findIndex(command => command === error.input);
    return {
      index: commandIndex >= 0 ? commandIndex + 1 : errorIndex + 1,
      input: error.input,
      type: title === "Import could not be read" ? "invalid-import" : importConflictTypeFor(error.message),
      message: error.message,
      matchOptions: ambiguousPlayerMatchOptionsFor(error.message),
    };
  }),
});

const mockDraftRequestFor = (
  strategyKey: LiveDraftStrategyKey,
  seed: string | undefined,
  nominatedPlayer?: string,
  nominatedPrice?: number,
): { strategyKey: LiveDraftStrategyKey; seed?: string; nominatedPlayer?: string; nominatedPrice?: number } => ({
  strategyKey,
  ...(seed === undefined ? {} : { seed }),
  ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
  ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
});

const mockBatchStrategySequence = (
  preferredStrategyKey: LiveDraftStrategyKey,
  runCount: number,
  segmentSize = runCount,
): LiveDraftStrategyKey[] =>
  Array.from({ length: runCount }, (_, index) => {
    const cycle: readonly LiveDraftStrategyKey[] = preferredStrategyKey === "three-rb"
      ? ["three-rb", "balanced", "three-rb", "hero-rb", "three-rb", "wr-heavy", "balanced", "three-rb"]
      : preferredStrategyKey === "balanced"
        ? ["balanced", "three-rb", "balanced", "hero-rb", "balanced", "wr-heavy"]
        : preferredStrategyKey === "hero-rb"
          ? ["hero-rb", "balanced", "hero-rb", "wr-heavy", "balanced", "three-rb"]
          : ["wr-heavy", "balanced", "wr-heavy", "hero-rb", "balanced", "three-rb"];
    const segmentIndex = Math.max(0, index % Math.max(1, segmentSize));
    return cycle[segmentIndex % cycle.length] ?? preferredStrategyKey;
  });

const mockSpeedActions = new Set(["next-ai-sale", "next-cam-decision", "next-round", "complete-mock"]);

const mockDraftRecord = (mockDraft: unknown): Record<string, unknown> =>
  mockDraft && typeof mockDraft === "object" ? mockDraft as Record<string, unknown> : {};

const mockDraftPhaseFor = (mockDraft: unknown): string => {
  const phase = mockDraftRecord(mockDraft).phase;
  return typeof phase === "string" ? phase : "";
};

const mockDraftPickNumberFor = (mockDraft: unknown): number => {
  const pickNumber = mockDraftRecord(mockDraft).pickNumber;
  return typeof pickNumber === "number" && Number.isFinite(pickNumber) ? pickNumber : 1;
};

const mockDraftTopTargetNameFor = (mockDraft: unknown): string | undefined => {
  const topTargets = mockDraftRecord(mockDraft).topTargets;
  if (!Array.isArray(topTargets)) return undefined;
  const candidate = topTargets[0];
  if (!candidate || typeof candidate !== "object") return undefined;
  const name = (candidate as Record<string, unknown>).name;
  return typeof name === "string" && name.trim() ? name.trim() : undefined;
};

const mockDraftRoundForPick = (pickNumber: number): number =>
  Math.floor((Math.max(1, pickNumber) - 1) / ownerOrder.length);

export const createLiveDraftServer = async (
  options: CreateLiveDraftServerOptions = {},
): Promise<LiveDraftServerApp> => {
  const projections = options.projections ?? (await loadEspnWeeksOneToFour(projectionPath));
  const historicalRecords = options.historicalRecords ?? (await loadHistoricalAuctionRecords());
  const draftRoomRankings = options.draftRoomRankings ?? (await loadDraftRoomRankings(defaultDraftRoomRankingPath));
  const pricingConfig = options.pricingConfig ?? (await buildPricingConfigFromSources());
  const baseSessionDirectory = options.sessionDirectory ?? defaultLiveDraftSessionDirectory;
  const sessionStorePairs = new Map<string, Promise<{
    real: FileBackedLiveDraftSessionStore;
    interactiveMock: FileBackedLiveDraftSessionStore;
  }>>();
  const storePairFor = (draftSessionKey: string): Promise<{
    real: FileBackedLiveDraftSessionStore;
    interactiveMock: FileBackedLiveDraftSessionStore;
  }> => {
    const existing = sessionStorePairs.get(draftSessionKey);
    if (existing) return existing;

    const sessionDirectory = draftSessionDirectoryFor(baseSessionDirectory, draftSessionKey);
    const real = new FileBackedLiveDraftSessionStore({ directory: sessionDirectory });
    const interactiveMock = new FileBackedLiveDraftSessionStore({
      directory: join(sessionDirectory, interactiveMockSessionDirectoryName),
    });
    const loaded = Promise.all([real.load(), interactiveMock.load()])
      .then(() => ({ real, interactiveMock }));
    sessionStorePairs.set(draftSessionKey, loaded);
    return loaded;
  };
  const storeFor = async (
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
  ): Promise<FileBackedLiveDraftSessionStore> => {
    const pair = await storePairFor(draftSessionKey);
    return mode === "interactive-mock" ? pair.interactiveMock : pair.real;
  };
  await storePairFor(defaultLiveDraftSessionKey);
  const mockBatchJobs = new Map<string, MockBatchJob>();
  const sessionMutationQueues = new Map<string, Promise<void>>();
  let latestMockBatchJobId: string | undefined;
  let playerNewsEvidenceRowsPromise: ReturnType<typeof loadPlayerEvidenceSourceRows> | undefined;
  const sleeperSyncPreviewProvider =
    options.sleeperSyncPreviewProvider ?? defaultSleeperSyncPreviewProvider;

  const playerNewsEvidenceRows = (): ReturnType<typeof loadPlayerEvidenceSourceRows> => {
    playerNewsEvidenceRowsPromise ??= loadPlayerEvidenceSourceRows({ path: playerNewsEvidencePath });
    return playerNewsEvidenceRowsPromise;
  };

  const sessionMutationQueueKey = (
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
  ): string =>
    `${draftSessionKey}\u0000${mode}`;

  const runQueuedSessionMutation = async <T>(
    draftSessionKey: string,
    mode: LiveDraftSessionMode,
    mutation: () => Promise<T>,
  ): Promise<T> => {
    const key = sessionMutationQueueKey(draftSessionKey, mode);
    const previous = sessionMutationQueues.get(key) ?? Promise.resolve();
    const queued = previous.then(mutation, mutation);
    sessionMutationQueues.set(key, queued.then(
      () => undefined,
      () => undefined,
    ));
    return queued;
  };

  const latestCompleteMockBatchReport = (): MockResultsReport | undefined => {
    const job = latestMockBatchJobId === undefined ? undefined : mockBatchJobs.get(latestMockBatchJobId);
    if (job?.source === "interactive-complete") return undefined;
    return job?.status === "complete" ? job.result : undefined;
  };

  const mockRangesFor = (report: MockResultsReport): Map<string, LiveDraftSaleMockRange> =>
    new Map(report.summary.players.map(player => [
      normalizePlayerName(player.name),
      {
        draftedRate: player.draftedRate,
        averageSalePrice: player.averageSalePrice,
        minimumSalePrice: player.minimumSalePrice,
        maximumSalePrice: player.maximumSalePrice,
      },
    ]));

  const stateWithLatestMockRanges = (state: LiveDraftState): LiveDraftState => {
    const report = latestCompleteMockBatchReport();
    if (!report || !state.postDraftAudit.length) return state;
    if (report.options.strategyKey !== state.strategy.key || report.script) return state;

    const ranges = mockRangesFor(report);
    return {
      ...state,
      postDraftAudit: state.postDraftAudit.map(audit => {
        const mockRange = ranges.get(audit.normalizedPlayerName);
        return mockRange ? { ...audit, mockRange } : audit;
      }),
    };
  };

  const stateFor = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    mode = defaultLiveDraftSessionMode,
    commands,
    strategyKey = defaultLiveDraftStrategyKey,
  }: {
    draftSessionKey?: string;
    mode?: LiveDraftSessionMode;
    commands?: readonly string[];
    strategyKey?: LiveDraftStrategyKey;
  } = {}): Promise<LiveDraftStateResponse> => {
    const canonicalMode = canonicalSessionModeFor(draftSessionKey, mode);
    const store = await storeFor(draftSessionKey, canonicalMode);
    const state = stateWithLatestMockRanges(buildLiveDraftState({
      projections,
      historicalRecords,
      keepers,
      watchOwner: "Cam",
      scenarioKey: "expected",
      strategyKey,
      pricingConfig,
      draftRoomRankings,
      commands: commands ?? store.currentCommands(),
      targetLimit: liveTargetLimit,
    }));
    const session = store.status();
    return {
      ...state,
      draftMode: canonicalMode,
      draftModes: liveDraftModes,
      activeDraftSession: activeDraftSessionDescriptorFor(draftSessionKey),
      draftSessions: draftSessionDescriptorsFor(draftSessionKey),
      draftNightLock: draftNightLockFor(draftSessionKey),
      session,
      readiness: readinessWithSession(state.readiness, session),
    };
  };
  const myExpertFor = async (url: URL): Promise<MyExpertResponse> => {
    const currentWeek = currentWeekFromQuery(url);
    const draftState = await stateFor({
      draftSessionKey: draftSessionKeyFromQuery(url),
      mode: sessionModeFromQuery(url),
      strategyKey: strategyKeyFromQuery(url),
    });
    const projectionsByPlayer = projectionLookupFor(projections);
    const roles = rosterRoleByPlayerId(draftState.watchOwner.slots);
    const roster = draftState.watchOwner.roster.map(player =>
      myExpertRosterPlayerFrom(
        player,
        roles.get(myExpertIdFor(player.name)) ?? "bench",
        projectionsByPlayer.get(projectionLookupKeyFor(player.name, player.position)),
        currentWeek,
      )
    );
    const rosterIds = new Set(roster.map(player => player.id));
    const availablePlayers = draftState.availableTargets
      .filter(target => !rosterIds.has(myExpertIdFor(target.name)))
      .slice(0, 120)
      .map(myExpertAvailablePlayerFrom);
    const advice = buildMyExpertAdvice({
      currentWeek,
      leagueSettings: {
        lineup: leagueConfig.lineup,
        rosterMaximums: leagueConfig.rosterMaximums,
      },
      roster,
      availablePlayers,
      matchups: [],
      news: [],
      tradeCandidates: [],
    });
    const playersById = myExpertPlayerLookup(roster, availablePlayers);
    const recommendations = advice.cards.map(card => myExpertRecommendationFrom({
      card,
      playersById,
      rosterIds,
    }));

    return {
      mode: "advice-only",
      readOnly: true,
      generatedAt: new Date().toISOString(),
      source: {
        key: "mockd-draft",
        label: "Mockd draft",
        readOnly: true,
        detail: "Current Mockd draft room state.",
      },
      team: {
        owner: "Cam",
        rosteredCount: roster.length,
        rosteredValue: draftState.watchOwner.spent,
        players: roster,
      },
      summary: {
        currentWeek,
        recommendationCount: recommendations.length,
        highPriorityCount: recommendations.filter(recommendation => recommendation.priority === "high").length,
      },
      recommendations,
      integrations: leagueSyncProviderStatuses(),
      policy: advice.policy,
    };
  };
  const playerNewsFor = async (url: URL): Promise<PlayerNewsFeed> => {
    const filters = playerNewsFiltersFromQuery(url);
    const sourceMode = filters.source ?? "all";
    const evidenceRows = sourceMode === "rotowire-rss" ? [] : await playerNewsEvidenceRows();
    let rawNewsItems: readonly RawPlayerNewsItem[] = [];

    if (sourceMode !== "local") {
      try {
        rawNewsItems = await (options.playerNewsProvider ?? fetchRotowireRssNews)();
      } catch (error) {
        if (sourceMode === "rotowire-rss") throw error;
      }
    }

    return buildPlayerNewsFeed({
      evidenceRows,
      rawNewsItems,
      playerMetadata: playerNewsMetadataFor(projections),
      draftState: await stateFor({
        draftSessionKey: draftSessionKeyFromQuery(url),
        mode: sessionModeFromQuery(url),
        strategyKey: strategyKeyFromQuery(url),
      }),
      filters,
      localEvidencePath: playerNewsEvidencePath,
    });
  };
  const mockDraftFor = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    commands,
    strategyKey,
    seed,
    nominatedPlayer,
    nominatedPrice,
  }: {
    draftSessionKey?: string;
    commands?: readonly string[];
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    nominatedPlayer?: string;
    nominatedPrice?: number;
  }): Promise<unknown> => {
    const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    return interactiveMockDraft.buildInteractiveMockDraftState({
      projections,
      historicalRecords,
      keepers,
      commands: commands ?? interactiveMockStore.currentCommands(),
      watchOwner: "Cam",
      strategyKey,
      pricingConfig,
      draftRoomRankings,
      ...(seed === undefined ? {} : { seed }),
      ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
      ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
    });
  };
  const stateWithMockDraft = async ({
    draftSessionKey = defaultLiveDraftSessionKey,
    strategyKey,
    seed,
    nominatedPlayer,
    nominatedPrice,
  }: {
    draftSessionKey?: string;
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    nominatedPlayer?: string;
    nominatedPrice?: number;
  }): Promise<LiveDraftStateResponse & { mockDraft: unknown }> => {
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    const commands = interactiveMockStore.currentCommands();
    return {
      ...await stateFor({ draftSessionKey, mode: "interactive-mock", commands, strategyKey }),
      mockDraft: await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
        draftSessionKey,
        commands,
      }),
    };
  };
  const unsafeLiveMutationMessage = ({
    draftSessionKey,
    mode,
    body,
    confirmField,
    actionLabel,
    commandCount,
  }: {
    draftSessionKey: string;
    mode: LiveDraftSessionMode;
    body: Record<string, unknown>;
    confirmField: "confirmImport" | "confirmReset" | "confirmUndo";
    actionLabel: "import" | "reset" | "undo";
    commandCount: number;
  }): string | undefined => {
    if (!isProtectedLiveDraftMutation(draftSessionKey, mode)) return undefined;

    const expectedCommandCount = body.expectedCommandCount;
    const expectedCountIsValid =
      typeof expectedCommandCount === "number" &&
      Number.isInteger(expectedCommandCount) &&
      expectedCommandCount >= 0;

    if (body[confirmField] !== true) {
      return `Live draft ${actionLabel} requires confirmation before changing the real room.`;
    }
    if (!expectedCountIsValid) {
      return `Live draft ${actionLabel} requires expectedCommandCount ${commandCount}.`;
    }
    if (expectedCommandCount !== commandCount) {
      return `Live draft ${actionLabel} expected ${expectedCommandCount} command(s), but the room currently has ${commandCount}. Refresh before trying again.`;
    }

    return undefined;
  };
  const exportBundleFor = async ({
    draftSessionKey,
    mode,
    strategyKey,
  }: {
    draftSessionKey: string;
    mode: LiveDraftSessionMode;
    strategyKey: LiveDraftStrategyKey;
  }): Promise<LiveDraftSessionExportBundle> => {
    const store = await storeFor(draftSessionKey, mode);
    const state = await stateFor({ draftSessionKey, mode, strategyKey });
    const commands = store.currentCommands();
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      activeDraftSession: state.activeDraftSession,
      draftMode: state.draftMode,
      session: state.session,
      readiness: state.readiness,
      currentSnapshot: await readJsonFileIfPresent(state.session.paths.currentPath),
      backupSnapshot: await readJsonFileIfPresent(state.session.paths.backupPath),
      auditLogJsonl: await readTextFileIfPresent(state.session.paths.logPath),
      commandsJson: liveDraftCommandsJson(commands),
      commandsCsv: liveDraftCommandsCsv(commands),
    };
  };
  const appendInteractiveMockCommand = async ({
    store,
    draftSessionKey,
    strategyKey,
    command,
  }: {
    store: FileBackedLiveDraftSessionStore;
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    command: string;
  }): Promise<{ input: string; message: string } | undefined> => {
    const trialCommands = [...store.currentCommands(), command];
    const trialState = await stateFor({
      draftSessionKey,
      mode: "interactive-mock",
      commands: trialCommands,
      strategyKey,
    });
    const commandError = trialState.errors.find(error => error.input === command);
    if (commandError) return commandError;

    await store.appendCommand(command);
    return undefined;
  };
  const publishInteractiveMockResultsJob = ({
    draftSessionKey,
    strategyKey,
    commandCount,
    batch,
  }: {
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    commandCount: number;
    batch: MockBatch;
  }): MockBatchJob => {
    if (!batch.runs[0]) throw new Error("Mock draft completion did not produce a run.");

    const now = new Date().toISOString();
    const completedJob: MockBatchJob = {
      jobId: `mock-complete-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "complete",
      source: "interactive-complete",
      draftSessionKey,
      draftMode: "interactive-mock",
      commandCount,
      strategyKey,
      runStrategyKeys: [strategyKey],
      runsPerScenario: 1,
      totalRuns: 1,
      completedRuns: 1,
      percent: 100,
      startedAt: now,
      updatedAt: now,
      result: buildMockResultsReport(batch, strategyKey, [strategyKey], undefined, ["Completed mock draft"]),
    };
    mockBatchJobs.set(completedJob.jobId, completedJob);
    latestMockBatchJobId = completedJob.jobId;
    return completedJob;
  };
  const interactiveMockBatchForCommands = async ({
    draftSessionKey,
    strategyKey,
    commands,
    seed,
  }: {
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    commands: readonly string[];
    seed?: string;
  }): Promise<MockBatch> => {
    const currentState = await stateFor({
      draftSessionKey,
      mode: "interactive-mock",
      commands,
      strategyKey,
    });
    if (currentState.errors.length) {
      throw new Error(currentState.errors.map(error => error.message).join("\n"));
    }

    const forcedSales: ForcedAuctionSale[] = currentState.events.map(event => ({
      owner: event.owner,
      player: event.player,
      price: event.price,
    }));
    const completeSeed = seed ?? `interactive-session-results:${draftSessionKey}:${commands.length}`;
    const batchRunner = options.mockBatchRunner ?? runMockBatch;
    return batchRunner({
      projections,
      historicalRecords,
      keepers,
      scenarioKeys: ["expected"],
      runsPerScenario: 1,
      seedPrefix: completeSeed,
      pricingConfig,
      auctionConfigOverrides: strategyAuctionOverridesFor("Cam", strategyKey, { variantSeed: completeSeed }),
      forcedSales,
      diagnosticsMode: "summary",
    });
  };
  const runMockSpeedAction = async ({
    draftSessionKey,
    strategyKey,
    seed,
    action,
    nominatedPlayer,
    nominatedPrice,
  }: {
    draftSessionKey: string;
    strategyKey: LiveDraftStrategyKey;
    seed?: string;
    action: string;
    nominatedPlayer?: string;
    nominatedPrice?: number;
  }): Promise<{ status: number; body: LiveDraftStateResponse & {
    mockDraft: unknown;
    mockBatchJob?: MockBatchJob;
    errors?: { input: string; message: string }[];
  } }> => {
    const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
    const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
    const commandForMockAction = (mockDraft: unknown, actionName: string): string => {
      let currentMockDraft = mockDraft;
      for (let bidStep = 0; bidStep < ownerOrder.length * 2; bidStep += 1) {
        const result = interactiveMockDraft.resolveInteractiveMockDraftAction(currentMockDraft, actionName);
        const command = optionalCommandFromInteractiveMockAction(result);
        if (command) return command;

        const unresolvedMockDraft = mockDraftFromInteractiveMockAction(result);
        if (!unresolvedMockDraft) break;
        currentMockDraft = unresolvedMockDraft;
      }

      throw new Error("Interactive mock action did not resolve to a sale command.");
    };

    if (action === "complete-mock") {
      const currentState = await stateFor({
        draftSessionKey,
        mode: "interactive-mock",
        strategyKey,
      });
      if (currentState.errors.length) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: currentState.errors,
          },
        };
      }

      let completionBaseCommands = [...interactiveMockStore.currentCommands()];
      const currentMockDraft = await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
        draftSessionKey,
        commands: completionBaseCommands,
      });
      const currentPhase = mockDraftPhaseFor(currentMockDraft);
      let visibleAuctionCommand: string | undefined;
      if (currentPhase === "ai-sale") {
        visibleAuctionCommand = commandForMockAction(currentMockDraft, "advance");
      } else if (currentPhase === "human-decision") {
        visibleAuctionCommand = commandForMockAction(currentMockDraft, "cam-bid");
      } else if (currentPhase === "human-nomination") {
        const automaticNomination = nominatedPlayer ?? mockDraftTopTargetNameFor(currentMockDraft);
        if (automaticNomination) {
          const nominatedMockDraft = await mockDraftFor({
            ...mockDraftRequestFor(strategyKey, seed, automaticNomination, nominatedPrice),
            draftSessionKey,
            commands: completionBaseCommands,
          });
          const nominatedPhase = mockDraftPhaseFor(nominatedMockDraft);
          visibleAuctionCommand = commandForMockAction(
            nominatedMockDraft,
            nominatedPhase === "human-decision" ? "cam-bid" : "advance",
          );
        }
      } else if (currentPhase === "blocked") {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: [{ input: "", message: "Mock draft is blocked and cannot be completed." }],
          },
        };
      }

      if (visibleAuctionCommand) {
        const trialCommands = [...completionBaseCommands, visibleAuctionCommand];
        const trialState = await stateFor({
          draftSessionKey,
          mode: "interactive-mock",
          commands: trialCommands,
          strategyKey,
        });
        const commandError = trialState.errors.find(error => error.input === visibleAuctionCommand);
        if (commandError) {
          return {
            status: 422,
            body: {
              ...await stateWithMockDraft({
                ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
                draftSessionKey,
              }),
              errors: [commandError],
            },
          };
        }
        completionBaseCommands = trialCommands;
      }

      const completionBaseState = await stateFor({
        draftSessionKey,
        mode: "interactive-mock",
        commands: completionBaseCommands,
        strategyKey,
      });
      const forcedSales: ForcedAuctionSale[] = completionBaseState.events.map(event => ({
        owner: event.owner,
        player: event.player,
        price: event.price,
      }));
      const completeSeed = seed ?? `interactive-complete:${draftSessionKey}:${completionBaseState.events.length}`;
      let batch: MockBatch;
      try {
        batch = runMockBatch({
          projections,
          historicalRecords,
          keepers,
          scenarioKeys: ["expected"],
          runsPerScenario: 1,
          seedPrefix: completeSeed,
          pricingConfig,
          auctionConfigOverrides: strategyAuctionOverridesFor("Cam", strategyKey, { variantSeed: completeSeed }),
          forcedSales,
          diagnosticsMode: "summary",
        });
      } catch (error) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: [{
              input: "",
              message: error instanceof Error ? error.message : "Could not complete mock draft.",
            }],
          },
        };
      }
      const run = batch.runs[0];
      if (!run) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: [{ input: "", message: "Mock draft completion did not produce a run." }],
          },
        };
      }

      const completedCommands = [
        ...completionBaseCommands,
        ...run.picks.map(pick => `${pick.owner} drafted ${pick.player} for ${pick.price}`),
      ];
      const completedState = await stateFor({
        draftSessionKey,
        mode: "interactive-mock",
        commands: completedCommands,
        strategyKey,
      });
      if (completedState.errors.length) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: completedState.errors,
          },
        };
      }

      await interactiveMockStore.importCommands(completedCommands);
      const completedJob = publishInteractiveMockResultsJob({
        draftSessionKey,
        strategyKey,
        commandCount: completedCommands.length,
        batch,
      });

      return {
        status: 200,
        body: {
          ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
          mockBatchJob: mockBatchJobResponseFor(completedJob),
        },
      };
    }

    const maximumSteps = ownerOrder.length * 20;
    let appendedCount = 0;
    let startRound: number | undefined;
    let nextNominatedPlayer = nominatedPlayer;
    let nextNominatedPrice = nominatedPrice;

    for (let step = 0; step < maximumSteps; step += 1) {
      const mockDraft = await mockDraftFor({
        ...mockDraftRequestFor(strategyKey, seed, nextNominatedPlayer, nextNominatedPrice),
        draftSessionKey,
      });
      const phase = mockDraftPhaseFor(mockDraft);
      const pickNumber = mockDraftPickNumberFor(mockDraft);
      startRound ??= mockDraftRoundForPick(pickNumber);

      if (action === "next-ai-sale" && appendedCount > 0) break;
      if ((action === "next-cam-decision" || action === "next-round") && (
        phase === "human-decision" ||
        phase === "human-nomination" ||
        phase === "complete" ||
        phase === "blocked"
      )) break;
      if (action === "next-round" && appendedCount > 0 && mockDraftRoundForPick(pickNumber) !== startRound) break;
      if (action === "complete-mock" && (phase === "complete" || phase === "blocked")) break;

      let command: string | undefined;
      if (phase === "ai-sale") {
        command = commandForMockAction(mockDraft, "advance");
      } else if (phase === "human-decision" && action === "complete-mock") {
        command = commandForMockAction(mockDraft, "cam-bid");
      } else if (phase === "human-nomination" && action === "complete-mock") {
        const automaticNomination = mockDraftTopTargetNameFor(mockDraft);
        if (!automaticNomination) break;
        const nominatedMockDraft = await mockDraftFor({
          ...mockDraftRequestFor(strategyKey, seed, automaticNomination),
          draftSessionKey,
        });
        const nominatedPhase = mockDraftPhaseFor(nominatedMockDraft);
        command = commandForMockAction(
          nominatedMockDraft,
          nominatedPhase === "human-decision" ? "cam-bid" : "advance",
        );
      } else {
        break;
      }

      const commandError = await appendInteractiveMockCommand({
        store: interactiveMockStore,
        draftSessionKey,
        strategyKey,
        command,
      });
      if (commandError) {
        return {
          status: 422,
          body: {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nextNominatedPlayer, nextNominatedPrice),
              draftSessionKey,
            }),
            errors: [commandError],
          },
        };
      }

      appendedCount += 1;
      nextNominatedPlayer = undefined;
      nextNominatedPrice = undefined;
    }

    return {
      status: 200,
      body: await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
    };
  };
  const mockBatchJobResponseFor = (job: MockBatchJob): MockBatchJob => ({
    jobId: job.jobId,
    status: job.status,
    ...(job.source === undefined ? {} : { source: job.source }),
    ...(job.draftSessionKey === undefined ? {} : { draftSessionKey: job.draftSessionKey }),
    ...(job.draftMode === undefined ? {} : { draftMode: job.draftMode }),
    ...(job.commandCount === undefined ? {} : { commandCount: job.commandCount }),
    strategyKey: job.strategyKey,
    runStrategyKeys: job.runStrategyKeys,
    ...(job.script === undefined ? {} : { script: job.script }),
    runsPerScenario: job.runsPerScenario,
    totalRuns: job.totalRuns,
    completedRuns: job.completedRuns,
    percent: job.percent,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    ...(job.result === undefined ? {} : { result: job.result }),
    ...(job.error === undefined ? {} : { error: job.error }),
  });

  const updateMockBatchJobProgress = (
    job: MockBatchJob,
    completedRuns: number,
  ): void => {
    job.completedRuns = completedRuns;
    job.percent = job.totalRuns <= 0 ? 100 : Math.round((completedRuns / job.totalRuns) * 100);
    job.updatedAt = new Date().toISOString();
  };

  const yieldToEventLoop = async (): Promise<void> =>
    new Promise(resolve => {
      setTimeout(resolve, 0);
    });

  const runMockBatchJob = async ({
    job,
    runsPerScenario,
    seedPrefix,
  }: {
    job: MockBatchJob;
    runsPerScenario: number;
    seedPrefix: string;
  }): Promise<void> => {
    job.status = "running";
    job.updatedAt = new Date().toISOString();

    try {
      const scriptOverrides = targetMaxBidOverridesFor(job.script);
      const priceCount = buildAroundPriceCountFor(job.script);
      const totalRuns = runsPerScenario * priceCount;
      const runLabels = buildAroundRunLabelsFor(job.script, runsPerScenario, job.runStrategyKeys);
      let batch: MockBatch;

      if (options.mockBatchRunner && job.script?.buildAround) {
        const runs: MockBatch["runs"] = [];
        for (let priceIndex = 0; priceIndex < job.script.buildAround.prices.length; priceIndex += 1) {
          const price = job.script.buildAround.prices[priceIndex];
          if (price === undefined) continue;
          const segment = options.mockBatchRunner({
            projections,
            historicalRecords,
            keepers,
            scenarioKeys: ["expected"],
            runsPerScenario,
            seedPrefix: `${seedPrefix}:build-around:${normalizePlayerName(job.script.buildAround.player)}:${price}`,
            pricingConfig,
            auctionConfigOverrides: mergeAuctionConfigOverrides(
              strategyAuctionOverridesFor("Cam", job.strategyKey, { variantSeed: `${seedPrefix}:${price}` }),
              scriptOverrides,
            ),
            forcedSales: [{ owner: job.script.buildAround.owner, player: job.script.buildAround.player, price }],
            diagnosticsMode: "summary",
          });
          runs.push(...segment.runs);
          updateMockBatchJobProgress(job, Math.min(totalRuns, runs.length));
          await yieldToEventLoop();
        }

        batch = {
          options: {
            scenarioKeys: ["expected"],
            runsPerScenario,
            seedPrefix,
            diagnosticsMode: "summary",
          },
          runs,
          summary: summarizeMockBatch(runs),
        };
      } else {
        batch = options.mockBatchRunner
          ? options.mockBatchRunner({
            projections,
            historicalRecords,
            keepers,
            scenarioKeys: ["expected"],
            runsPerScenario,
            seedPrefix,
            pricingConfig,
            auctionConfigOverrides: mergeAuctionConfigOverrides(
              strategyAuctionOverridesFor("Cam", job.strategyKey, { variantSeed: seedPrefix }),
              scriptOverrides,
            ),
            diagnosticsMode: "summary",
          })
          : await runMockBatchProgressively({
            projections,
            historicalRecords,
            keepers,
            scenarioKeys: ["expected"],
            runsPerScenario: totalRuns,
            seedPrefix,
            pricingConfig,
            auctionConfigOverridesForRun: context =>
              mergeAuctionConfigOverrides(
                strategyAuctionOverridesFor(
                  "Cam",
                  job.runStrategyKeys[context.completedRuns] ?? job.strategyKey,
                  { variantSeed: context.seed },
                ),
                scriptOverrides,
              ),
            ...(job.script?.buildAround === undefined
              ? {}
              : {
                forcedSalesForRun: context =>
                  forcedSalesForBuildAroundRun(job.script, context.completedRuns, runsPerScenario) ?? [],
              }),
            diagnosticsMode: "summary",
            onRunComplete: async progress => {
              updateMockBatchJobProgress(job, progress.completedRuns);
              await yieldToEventLoop();
            },
          });
        if (job.script?.buildAround) {
          batch = {
            ...batch,
            options: {
              ...batch.options,
              runsPerScenario,
            },
          };
        }
      }

      updateMockBatchJobProgress(job, job.totalRuns);
      job.status = "complete";
      job.result = buildMockResultsReport(batch, job.strategyKey, job.runStrategyKeys, job.script, runLabels);
      job.updatedAt = new Date().toISOString();
    } catch (error) {
      job.status = "failed";
      job.error = error instanceof Error ? error.message : "Unknown mock batch error.";
      job.updatedAt = new Date().toISOString();
    }
  };

  const startMockBatchJob = ({
    strategyKey,
    runsPerScenario,
    seedPrefix,
    script,
  }: {
    strategyKey: LiveDraftStrategyKey;
    runsPerScenario: number;
    seedPrefix: string;
    script?: MockDraftScript;
  }): MockBatchJob => {
    const now = new Date().toISOString();
    const totalRuns = runsPerScenario * buildAroundPriceCountFor(script);
    const job: MockBatchJob = {
      jobId: `mock-batch-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      status: "queued",
      strategyKey,
      runStrategyKeys: mockBatchStrategySequence(strategyKey, totalRuns, runsPerScenario),
      ...(script === undefined ? {} : { script }),
      runsPerScenario,
      totalRuns,
      completedRuns: 0,
      percent: 0,
      startedAt: now,
      updatedAt: now,
    };

    mockBatchJobs.set(job.jobId, job);
    latestMockBatchJobId = job.jobId;
    void runMockBatchJob({ job, runsPerScenario, seedPrefix });
    return job;
  };

  const server = http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`);

      if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/draft-room")) {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/mock-results") {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/my-expert") {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/player-news") {
        sendHtml(response);
        return;
      }

      if (request.method === "GET" && url.pathname === "/favicon.ico") {
        response.writeHead(204, { "cache-control": "no-store" });
        response.end();
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/state") {
        const draftSessionKey = draftSessionKeyFromQuery(url);
        sendJson(response, 200, await stateFor({
          draftSessionKey,
          mode: sessionModeFromQueryForSession(url, draftSessionKey),
          strategyKey: strategyKeyFromQuery(url),
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mock/state") {
        const strategyKey = strategyKeyFromQuery(url);
        const seed = seedFromValue(url.searchParams.get("seed"));
        const nominatedPlayer = nominatedPlayerFromValue(url.searchParams.get("nominatedPlayer"));
        const nominatedPrice = nominatedPriceFromValue(url.searchParams.get("nominatedPrice"));
        sendJson(response, 200, await stateWithMockDraft({
          ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
          draftSessionKey: draftSessionKeyFromQuery(url),
        }));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/player-news") {
        sendJson(response, 200, await playerNewsFor(url));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/my-expert") {
        sendJson(response, 200, await myExpertFor(url));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/sync/providers") {
        sendJson(response, 200, {
          policy: leagueSyncReadOnlyPolicy,
          providers: leagueSyncProviderStatuses(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/sync/oauth/yahoo/start") {
        const body = yahooOAuthStartResponse(request);
        const statusCode = "error" in (body as { error?: string }) ? 501 : 200;
        sendJson(response, statusCode, body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/sync/oauth/yahoo/callback") {
        const result = yahooOAuthCallbackResponse(url);
        sendJson(response, result.statusCode, result.body);
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/sync/sleeper/preview") {
        const identifier = url.searchParams.get("identifier")?.trim() ?? "";
        const season = url.searchParams.get("season")?.trim() || "2026";
        if (!identifier) {
          sendJson(response, 400, {
            provider: "sleeper",
            readOnly: true,
            error: "Sleeper username or league ID is required.",
          });
          return;
        }

        try {
          sendJson(response, 200, await sleeperSyncPreviewProvider({ identifier, season }));
        } catch (error) {
          sendJson(response, 502, {
            provider: "sleeper",
            readOnly: true,
            identifier,
            season,
            error: error instanceof Error ? error.message : "Could not preview Sleeper sync.",
          });
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/export") {
        const format = url.searchParams.get("format") === "csv" ? "csv" : "json";
        const draftSessionKey = draftSessionKeyFromQuery(url);
        const store = await storeFor(draftSessionKey, sessionModeFromQueryForSession(url, draftSessionKey));
        const commands = store.currentCommands();
        if (format === "csv") {
          sendText(response, 200, "text/csv", liveDraftCommandsCsv(commands));
        } else {
          sendText(response, 200, "application/json", liveDraftCommandsJson(commands));
        }
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/export-bundle") {
        const draftSessionKey = draftSessionKeyFromQuery(url);
        sendText(response, 200, "application/json", `${JSON.stringify(await exportBundleFor({
          draftSessionKey,
          mode: sessionModeFromQueryForSession(url, draftSessionKey),
          strategyKey: strategyKeyFromQuery(url),
        }), null, 2)}\n`);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/events") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const mode = sessionModeFromBodyForSession(body, draftSessionKey);
        const store = await storeFor(draftSessionKey, mode);
        const command = typeof body.command === "string" ? body.command.trim() : "";
        if (!command) {
          sendJson(response, 422, {
            ...await stateFor({ draftSessionKey, mode, strategyKey }),
            errors: [{ input: "", message: "Command is required." }],
          });
          return;
        }

        const result = await runQueuedSessionMutation(draftSessionKey, mode, async (): Promise<LiveDraftMutationResult> => {
          const trialCommands = [...store.currentCommands(), command];
          const trialState = await stateFor({ draftSessionKey, mode, commands: trialCommands, strategyKey });
          const commandError = trialState.errors.find(error => error.input === command);
          if (commandError) {
            return {
              status: 422,
              body: { ...await stateFor({ draftSessionKey, mode, strategyKey }), errors: [commandError] },
            };
          }

          await store.appendCommand(command);
          return {
            status: 200,
            body: await stateFor({ draftSessionKey, mode, strategyKey }),
          };
        });
        sendJson(response, result.status, result.body);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock/advance") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const seed = seedFromValue(body.seed);
        const nominatedPlayer = nominatedPlayerFromValue(body.nominatedPlayer);
        const nominatedPrice = nominatedPriceFromValue(body.nominatedPrice);
        const mockAuction = mockAuctionFromValue(body.mockAuction);
        const action = typeof body.action === "string" ? body.action.trim() : "";
        const lock = draftNightLockFor(draftSessionKey);
        if (lock.locked) {
          sendJson(response, 423, {
            ...await stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey }),
            errors: [{ input: "", message: lock.reason ?? "Live session is locked for mock draft advances." }],
          });
          return;
        }

        if (!action) {
          sendJson(response, 422, {
            ...await stateWithMockDraft({
              ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
              draftSessionKey,
            }),
            errors: [{ input: "", message: "Mock draft action is required." }],
          });
          return;
        }

        if (mockSpeedActions.has(action)) {
          const result = await runQueuedSessionMutation(draftSessionKey, "interactive-mock", () =>
            runMockSpeedAction({
              draftSessionKey,
              strategyKey,
              action,
              ...(seed === undefined ? {} : { seed }),
              ...(nominatedPlayer === undefined ? {} : { nominatedPlayer }),
              ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
            }),
          );
          sendJson(response, result.status, result.body);
          return;
        }

        if (action === "cam-nominate") {
          if (!nominatedPlayer) {
            sendJson(response, 422, {
              ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
              errors: [{ input: "", message: "Select a player for Cam to nominate." }],
            });
            return;
          }

          sendJson(response, 200, await stateWithMockDraft({
            ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
            draftSessionKey,
          }));
          return;
        }

        const result = await runQueuedSessionMutation(draftSessionKey, "interactive-mock", async (): Promise<LiveDraftMutationResult> => {
          const interactiveMockDraft = await loadInteractiveMockDraftModule(options.interactiveMockDraft);
          const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
          const restoredNominatedPlayer = nominatedPlayer ?? mockAuctionPlayerFromValue(mockAuction);
          const restoredNominatedPrice = nominatedPrice ?? mockAuctionOpeningBidFromValue(mockAuction);
          const mockDraft = mockDraftWithClientAuction(
            await mockDraftFor({
              ...mockDraftRequestFor(strategyKey, seed, restoredNominatedPlayer, restoredNominatedPrice),
              draftSessionKey,
            }),
            mockAuction,
          );
          const actionResult = interactiveMockDraft.resolveInteractiveMockDraftAction(mockDraft, action);
          const unresolvedMockDraft = mockDraftFromInteractiveMockAction(actionResult);
          const command = optionalCommandFromInteractiveMockAction(actionResult);
          if (!command) {
            return {
              status: 200,
              body: {
                ...await stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey }),
                mockDraft: unresolvedMockDraft ?? mockDraft,
              },
            };
          }
          const trialCommands = [...interactiveMockStore.currentCommands(), command];
          const trialState = await stateFor({
            draftSessionKey,
            mode: "interactive-mock",
            commands: trialCommands,
            strategyKey,
          });
          const commandError = trialState.errors.find(error => error.input === command);
          if (commandError) {
            return {
              status: 422,
              body: {
                ...await stateWithMockDraft({
                  ...mockDraftRequestFor(strategyKey, seed, nominatedPlayer, nominatedPrice),
                  draftSessionKey,
                }),
                errors: [commandError],
              },
            };
          }

          await interactiveMockStore.appendCommand(command);
          return {
            status: 200,
            body: await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
          };
        });
        sendJson(response, result.status, result.body);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock/session-results") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const seed = seedFromValue(body.seed ?? body.seedPrefix);
        const lock = draftNightLockFor(draftSessionKey);
        if (lock.locked) {
          sendJson(response, 423, {
            ...await stateFor({ draftSessionKey, mode: "interactive-mock", strategyKey }),
            errors: [{ input: "", message: lock.reason ?? "Live session is locked for mock draft results." }],
          });
          return;
        }

        const result = await runQueuedSessionMutation(draftSessionKey, "interactive-mock", async (): Promise<InteractiveMockResultsPublishResult> => {
          const interactiveMockStore = await storeFor(draftSessionKey, "interactive-mock");
          const commands = interactiveMockStore.currentCommands();
          const expectedCommandCount = body.expectedCommandCount;
          if (
            typeof expectedCommandCount === "number" &&
            Number.isInteger(expectedCommandCount) &&
            expectedCommandCount !== commands.length
          ) {
            return {
              status: 409,
              body: {
                ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
                errors: [{
                  input: "",
                  message: `Mock results expected ${expectedCommandCount} command(s), but the room currently has ${commands.length}. Refresh before viewing results.`,
                }],
              },
            };
          }

          let batch: MockBatch;
          try {
            batch = await interactiveMockBatchForCommands({
              draftSessionKey,
              strategyKey,
              commands,
              ...(seed === undefined ? {} : { seed }),
            });
          } catch (error) {
            return {
              status: 422,
              body: {
                ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
                errors: [{
                  input: "",
                  message: error instanceof Error ? error.message : "Could not build results from the current mock draft.",
                }],
              },
            };
          }

          let mockBatchJob: MockBatchJob;
          try {
            mockBatchJob = publishInteractiveMockResultsJob({
              draftSessionKey,
              strategyKey,
              commandCount: commands.length,
              batch,
            });
          } catch (error) {
            return {
              status: 422,
              body: {
                ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
                errors: [{
                  input: "",
                  message: error instanceof Error ? error.message : "Could not publish mock draft results.",
                }],
              },
            };
          }

          return {
            status: 200,
            body: {
              ...await stateWithMockDraft({ ...mockDraftRequestFor(strategyKey, seed), draftSessionKey }),
              mockBatchJob,
            },
          };
        });
        sendJson(response, result.status, {
          ...result.body,
          ...(result.body.mockBatchJob === undefined
            ? {}
            : { mockBatchJob: mockBatchJobResponseFor(result.body.mockBatchJob) }),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/mock-batch") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        let script: MockDraftScript | undefined;
        try {
          script = mockDraftScriptFromBody(body);
          if (script) script = canonicalizeMockDraftScript(script, projections.map(projection => projection.name));
        } catch (error) {
          sendJson(response, 422, {
            error: error instanceof Error ? error.message : "Mock script could not be read.",
          });
          return;
        }
        const requestedRunsPerScenario = batchRunsPerScenarioFromValue(body.runs ?? body.runsPerScenario);
        const runsPerScenario = script?.runsPerScenario === undefined
          ? requestedRunsPerScenario
          : batchRunsPerScenarioFromValue(script.runsPerScenario);
        const seedPrefix = seedPrefixFromValue(body.seedPrefix);
        const job = startMockBatchJob({
          strategyKey,
          runsPerScenario,
          seedPrefix,
          ...(script === undefined ? {} : { script }),
        });
        sendJson(response, 202, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "GET" && url.pathname === "/api/mock-batch/latest") {
        const job = latestMockBatchJobId === undefined ? undefined : mockBatchJobs.get(latestMockBatchJobId);
        if (!job) {
          sendJson(response, 200, null);
          return;
        }

        sendJson(response, 200, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "GET" && url.pathname.startsWith("/api/mock-batch/")) {
        const jobId = decodeURIComponent(url.pathname.slice("/api/mock-batch/".length));
        const job = mockBatchJobs.get(jobId);
        if (!job) {
          sendJson(response, 404, { error: `Unknown mock batch job "${jobId}".` });
          return;
        }

        sendJson(response, 200, mockBatchJobResponseFor(job));
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/import") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const mode = sessionModeFromBodyForSession(body, draftSessionKey);
        const store = await storeFor(draftSessionKey, mode);
        let importedCommands: string[];
        try {
          importedCommands = Array.isArray(body.commands)
            ? parseLiveDraftCommandImport(JSON.stringify({ commands: body.commands }), "json")
            : parseLiveDraftCommandImport(
              typeof body.content === "string" ? body.content : "",
              importFormatFor(body.format),
            );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Draft log import could not be read.";
          const parseError = { input: "", message };
          sendJson(response, 422, {
            ...await stateFor({ draftSessionKey, mode, strategyKey }),
            errors: [parseError],
            conflictReview: importConflictReviewFor([], [parseError], "Import could not be read"),
          });
          return;
        }

        const result = await runQueuedSessionMutation(draftSessionKey, mode, async (): Promise<LiveDraftMutationResult> => {
          const unsafeMessage = unsafeLiveMutationMessage({
            draftSessionKey,
            mode,
            body,
            confirmField: "confirmImport",
            actionLabel: "import",
            commandCount: store.currentCommands().length,
          });
          if (unsafeMessage) {
            return {
              status: 409,
              body: {
                ...await stateFor({ draftSessionKey, mode, strategyKey }),
                errors: [{ input: "", message: unsafeMessage }],
              },
            };
          }

          const trialState = await stateFor({ draftSessionKey, mode, commands: importedCommands, strategyKey });
          if (trialState.errors.length) {
            return {
              status: 422,
              body: {
                ...await stateFor({ draftSessionKey, mode, strategyKey }),
                errors: trialState.errors,
                conflictReview: importConflictReviewFor(importedCommands, trialState.errors),
              },
            };
          }

          await store.importCommands(importedCommands);
          return {
            status: 200,
            body: await stateFor({ draftSessionKey, mode, strategyKey }),
          };
        });
        sendJson(response, result.status, result.body);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/undo") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const mode = sessionModeFromBodyForSession(body, draftSessionKey);
        const store = await storeFor(draftSessionKey, mode);
        const result = await runQueuedSessionMutation(draftSessionKey, mode, async (): Promise<LiveDraftMutationResult> => {
          const unsafeMessage = unsafeLiveMutationMessage({
            draftSessionKey,
            mode,
            body,
            confirmField: "confirmUndo",
            actionLabel: "undo",
            commandCount: store.currentCommands().length,
          });
          if (unsafeMessage) {
            return {
              status: 409,
              body: {
                ...await stateFor({ draftSessionKey, mode, strategyKey }),
                errors: [{ input: "", message: unsafeMessage }],
              },
            };
          }

          await store.undo();
          return {
            status: 200,
            body: await stateFor({ draftSessionKey, mode, strategyKey }),
          };
        });
        sendJson(response, result.status, result.body);
        return;
      }

      if (request.method === "POST" && url.pathname === "/api/reset") {
        const body = await parseJsonBody(request);
        const strategyKey = strategyKeyFromBody(body);
        const draftSessionKey = draftSessionKeyFromBody(body);
        const mode = sessionModeFromBodyForSession(body, draftSessionKey);
        const store = await storeFor(draftSessionKey, mode);
        const result = await runQueuedSessionMutation(draftSessionKey, mode, async (): Promise<LiveDraftMutationResult> => {
          const unsafeMessage = unsafeLiveMutationMessage({
            draftSessionKey,
            mode,
            body,
            confirmField: "confirmReset",
            actionLabel: "reset",
            commandCount: store.currentCommands().length,
          });
          if (unsafeMessage) {
            return {
              status: 409,
              body: {
                ...await stateFor({ draftSessionKey, mode, strategyKey }),
                errors: [{ input: "", message: unsafeMessage }],
              },
            };
          }

          await store.reset();
          return {
            status: 200,
            body: await stateFor({ draftSessionKey, mode, strategyKey }),
          };
        });
        sendJson(response, result.status, result.body);
        return;
      }

      sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      sendJson(response, 500, {
        error: error instanceof Error ? error.message : "Unknown live draft server error.",
      });
    }
  });

  return { server };
};

const main = async (): Promise<void> => {
  const port = portFromOptions();
  const sessionDirectory = sessionDirectoryFromOptions();
  const { server } = await createLiveDraftServer(
    sessionDirectory === undefined ? {} : { sessionDirectory },
  );

  server.listen(port, () => {
    console.log(`Mockd live draft UI: http://localhost:${port}`);
  });
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
