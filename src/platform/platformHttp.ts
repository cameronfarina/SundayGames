import { randomUUID, timingSafeEqual } from "node:crypto";
import { canonicalPlayerIdentityKey } from "../data/normalizePlayerName.js";
import {
  liveDraftStrategies,
  parseLiveDraftStrategyKey,
  strategyAdjustedAuctionValue,
  type LiveDraftStrategyKey,
} from "../modeling/liveDraftStrategies.js";
import { AuthError, normalizeEmail } from "./auth.js";
import type {
  ClientAddressRateLimiter,
  NormalizedEmailRateLimiter,
} from "./authRateLimit.js";
import type { SessionRecord } from "./auth.js";
import { DraftExportError } from "./draftExport.js";
import { ExportArtifactError } from "./exportArtifacts.js";
import type {
  EspnLeagueSettingsImportInput,
  EspnLeagueSettingsImportOutcome,
} from "./espnLeagueSettingsImport.js";
import { JobError } from "./jobs.js";
import {
  confirmedLeagueCreationInputFromUnknown,
  createLeagueSeasonFromConfirmedSetup,
  LeagueCreationError,
} from "./leagueCreation.js";
import {
  assessLeagueSeasonReadiness,
  type LeagueSeason,
} from "./leagueSeason.js";
import {
  LeagueSetupWriteConflictError,
  type LeagueSetupRepository,
} from "./leagueSetup.js";
import {
  LiveDraftRoomError,
  type LiveDraftRoom,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
import { formatLiveDraftRoomSsePayloads } from "./liveDraftRoomStream.js";
import type {
  LiveDraftRoomSetup,
  LiveDraftRoomSetupRepository,
} from "./liveDraftRoomSetups.js";
import {
  liveDraftRoomSetupContentHash,
  LiveDraftRoomSetupWriteConflictError,
} from "./liveDraftRoomSetups.js";
import {
  MockDraftSessionError,
  type MockDraftModeMetadata,
  type MockDraftResultReference,
  type MockDraftSession,
} from "./mockSessions.js";
import {
  createSeasonMockConfigurationSnapshot,
  seasonMockReplayConfiguration,
  SeasonMockConfigurationSnapshotError,
  type SeasonMockConfigurationSnapshotV2,
} from "./seasonMockSnapshot.js";
import {
  createPlatformApp,
  PlatformAppError,
  type PlatformLeagueMembership,
} from "./platformApp.js";
import {
  analyzeLeagueMembersScreenshot,
  applyLeagueMembersScreenshotImport,
  applyLeagueSetupImport,
  previewLeagueSetupImport,
  type PlatformLeagueSetupImportInput,
  type PlatformLeagueSetupImportKnownUser,
} from "./platformSetupHttp.js";
import type {
  LeagueMembersScreenshotConfidence,
  LeagueMembersScreenshotImportInput,
} from "./leagueMembersScreenshotImport.js";
import {
  LeagueMembersScreenshotAnalyzerError,
  type LeagueMembersScreenshotAnalyzer,
} from "./openAiLeagueMembersScreenshotAnalyzer.js";
import {
  SimulationError,
  type SimulationStrategyInput,
} from "./simulations.js";
import {
  HistoricalImportError,
  HistoricalImportTargetError,
  type HistoricalOwnerMapping,
  type HistoricalSaleRecord,
} from "./historicalImports.js";
import {
  historicalSpreadsheetUploadToSourceText,
  HistoricalSpreadsheetUploadError,
} from "./historicalSpreadsheetImport.js";
import {
  PricingSnapshotError,
  type PricingSnapshot,
  type PricingSourcePrice,
} from "./pricingSnapshots.js";
import type {
  PreflightLeaguePricingWorkflowResult,
  RebuildLeaguePricingWorkflowResult,
} from "./platformPricingWorkflow.js";
import {
  clearMockdSessionCookie,
  mockdSessionCookie,
} from "./platformCookies.js";
import {
  acceptPlatformInvitation,
  issuePlatformLeagueInvitation,
  issuePlatformInvitation,
  joinPlatformLeagueInvitation,
  listPlatformInvitations,
  hashPlatformInvitationToken,
  PlatformInvitationError,
  reissuePlatformInvitation,
  revokePlatformInvitation,
  type AcceptedPlatformInvitation,
  type PlatformInvitationRepository,
} from "./platformInvitations.js";
import {
  loadPlatformOnboarding,
  type PlatformOnboardingRepository,
} from "./platformOnboarding.js";
import {
  analyzeEndedLiveDraftRoomTeam,
  PostDraftLiveRoomAdapterError,
} from "./postDraftLiveRoomAdapter.js";
import type { PostDraftProjectionSnapshot } from "./postDraftTeamAnalysis.js";
import { loadLeagueScoredWeekOneProjections } from "./currentPostDraftProjectionSnapshot.js";
import {
  applySeasonKeeperCommand,
  listSeasonKeepers,
  previewSeasonKeeperCommand,
  removeSeasonKeeper,
  SeasonKeeperSetupError,
} from "./seasonKeeperSetup.js";
import {
  buildSeasonSnakeMockConfig,
  replaySeasonSnakeMockCommands,
  SeasonSnakeMockError,
} from "./seasonSnakeMock.js";
import { SnakeDraftError, type SnakeDraftState } from "./snakeDraftEngine.js";
import {
  buildSeasonAuctionMockConfig,
  replaySeasonAuctionMockCommands,
  SeasonAuctionMockError,
} from "./seasonAuctionMock.js";
import {
  GenericAuctionMockError,
  type GenericAuctionMockState,
} from "./genericAuctionMockEngine.js";
import { buildSeasonMockResults } from "./seasonMockResults.js";
import {
  maximumSeasonSimulationRunCount,
  runSeasonSimulations,
  SeasonSimulationError,
} from "./seasonSimulationEngine.js";
import type { SeasonSimulationRunner } from "./seasonSimulationWorkerRunner.js";

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
  error: {
    code: string;
    message: string;
  };
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
  espnLeagueSettingsImporter?: ((
    input: EspnLeagueSettingsImportInput,
  ) => Promise<EspnLeagueSettingsImportOutcome>) | undefined;
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
  seasonSimulationRunner?: SeasonSimulationRunner | undefined;
}

interface ParsedPlatformHttpRequest {
  method: string;
  segments: readonly string[];
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  headers: Record<string, string | undefined>;
  clientAddress: string;
  now?: Date | undefined;
  sessionToken: string;
  signal?: AbortSignal | undefined;
}

type PublicSessionRecord = Omit<SessionRecord, "tokenHash">;

const invalidCredentialsBody: PlatformHttpErrorBody = {
  error: {
    code: "invalid_credentials",
    message: "Email or password is incorrect.",
  },
};

const authRequiredBody: PlatformHttpErrorBody = {
  error: {
    code: "auth_required",
    message: "Sign in before using this workspace.",
  },
};

const healthyResponseBody = {
  service: "mockd-platform",
  status: "ok",
} as const;

const unavailableResponseBody = {
  service: "mockd-platform",
  status: "unavailable",
} as const;

const notFound = (): PlatformHttpResponse<PlatformHttpErrorBody> => ({
  status: 404,
  body: {
    error: {
      code: "route_not_found",
      message: "Route was not found.",
    },
  },
});

const methodNotAllowed = (): PlatformHttpResponse<PlatformHttpErrorBody> => ({
  status: 405,
  body: {
    error: {
      code: "method_not_allowed",
      message: "Method is not allowed for this route.",
    },
  },
});

const bodyRecord = (body: unknown): Record<string, unknown> =>
  body !== null && typeof body === "object" && !Array.isArray(body)
    ? body as Record<string, unknown>
    : {};

const unknownRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;

const queryRecordFor = (url: URL, query: Record<string, unknown> | undefined): Record<string, unknown> => {
  const searchQuery: Record<string, unknown> = {};

  for (const [key, value] of url.searchParams.entries()) {
    searchQuery[key] = value;
  }

  return {
    ...searchQuery,
    ...(query ?? {}),
  };
};

const headerValue = (
  headers: Record<string, string | undefined> | undefined,
  headerName: string,
): string | undefined => {
  const target = headerName.toLowerCase();

  return Object.entries(headers ?? {})
    .find(([candidate]) => candidate.toLowerCase() === target)?.[1];
};

const stringValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "";

  return String(value);
};

const optionalString = (value: unknown): string | undefined => {
  const text = typeof value === "string" ? value : undefined;

  return text === undefined || text.length === 0 ? undefined : text;
};

const optionalNumber = (value: unknown): number | undefined => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);

  return undefined;
};

const optionalBoolean = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") return true;
  if (normalized === "false" || normalized === "0" || normalized === "no") return false;

  return undefined;
};

const dateValue = (value: unknown): Date | undefined => {
  if (value instanceof Date) return value;
  if (typeof value !== "string" && typeof value !== "number") return undefined;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requestDate = (
  body: Record<string, unknown>,
  query: Record<string, unknown>,
  key: string,
): Date | undefined => dateValue(body[key] ?? query[key]);

const arrayValue = (value: unknown): readonly unknown[] =>
  Array.isArray(value) ? value : [];

const stringArrayValue = (value: unknown): readonly string[] =>
  arrayValue(value).map(stringValue);

const mockDraftResultReferenceFor = (value: unknown): MockDraftResultReference | undefined => {
  const record = unknownRecord(value);
  if (record === null) return undefined;

  const id = optionalString(record.id);
  const kind = optionalString(record.kind);
  if (id === undefined || (kind !== "mock-result" && kind !== "simulation-result")) return undefined;

  const label = optionalString(record.label);

  return {
    id,
    kind,
    ...(label === undefined ? {} : { label }),
  };
};

const liveDraftSaleInputFor = (
  body: Record<string, unknown>,
): LiveDraftRoomSaleCommandInput => {
  if (typeof body.command === "string") return body.command;

  const structuredSale = unknownRecord(body.structuredSale);
  if (structuredSale !== null) return structuredSale as unknown as LiveDraftRoomSaleCommandInput;

  return body.sale as LiveDraftRoomSaleCommandInput;
};

const bearerSessionToken = (authorization: string | undefined): string | undefined => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);

  return match?.[1];
};

const sessionTokenFor = (
  request: PlatformHttpRequest,
): string =>
  request.sessionToken ??
  headerValue(request.headers, "x-session-token") ??
  headerValue(request.headers, "session-token") ??
  headerValue(request.headers, "sessiontoken") ??
  bearerSessionToken(headerValue(request.headers, "authorization")) ??
  "";

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const hostnameForCookiePolicy = (hostHeader: string | undefined): string | undefined => {
  const host = hostHeader?.trim().toLowerCase();
  if (host === undefined || host.length === 0) return undefined;
  if (host.startsWith("[")) {
    const endBracketIndex = host.indexOf("]");

    return endBracketIndex === -1 ? host : host.slice(1, endBracketIndex);
  }

  return host.split(":")[0];
};

const secureSessionCookieFor = (request: PlatformHttpRequest): boolean => {
  if (request.isSecure === true) return true;

  const forwardedProto = headerValue(request.headers, "x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProto === "https") return true;

  const hostname = hostnameForCookiePolicy(headerValue(request.headers, "host"));

  return hostname === undefined || !loopbackHostnames.has(hostname);
};

const publicSessionFor = (session: SessionRecord): PublicSessionRecord => ({
  id: session.id,
  accountId: session.accountId,
  createdAt: session.createdAt,
  expiresAt: session.expiresAt,
  revokedAt: session.revokedAt,
});

const parsedRequestFor = (request: PlatformHttpRequest): ParsedPlatformHttpRequest => {
  const url = new URL(request.path, "http://mockd.local");
  const body = bodyRecord(request.body);
  const query = queryRecordFor(url, request.query);

  return {
    method: request.method.toUpperCase(),
    segments: url.pathname.split("/").filter(Boolean).map(segment => decodeURIComponent(segment)),
    body,
    query,
    headers: request.headers ?? {},
    clientAddress: request.clientAddress ?? "unknown",
    now: request.now,
    sessionToken: sessionTokenFor(request),
    signal: request.signal,
  };
};

const secretMatches = (expected: string | undefined, actual: string | undefined): boolean => {
  if (expected === undefined || actual === undefined || expected.length === 0 || actual.length === 0) return false;
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
};

const hasProvisioningAccess = (
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): boolean => secretMatches(
  services.provisioningToken,
  headerValue(request.headers, "x-mockd-provisioning-token"),
);

const accountCreationDenied = async (
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse<PlatformHttpErrorBody> | null> => {
  if (
    services.allowPublicSignup === true ||
    hasProvisioningAccess(request, services) ||
    (services.invitationRepository === undefined && services.provisioningToken === undefined)
  ) return null;
  const invitationToken = optionalString(request.body.invitationToken);
  const repository = services.invitationRepository;
  if (invitationToken === undefined || repository === undefined) {
    return knownError(403, "invitation_required", "Use the account link from your league invitation.");
  }

  const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(invitationToken));
  const now = request.now ?? new Date();
  const email = normalizeEmail(stringValue(request.body.email));
  if (
    invitation === null ||
    invitation.status !== "pending" ||
    invitation.expiresAt < now ||
    (invitation.kind === "team" && invitation.email !== email)
  ) {
    return knownError(403, "invitation_required", "Use the account link from your league invitation.");
  }

  return null;
};

const authRateLimitResponse = (
  email: string,
  request: ParsedPlatformHttpRequest,
  emailLimiter: NormalizedEmailRateLimiter | undefined,
  clientLimiter: ClientAddressRateLimiter | undefined,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => {
  const normalized = normalizeEmail(email);
  const decisions = [
    emailLimiter?.consume(normalized, request.now),
    clientLimiter?.consume(request.clientAddress, request.now),
  ].filter(decision => decision !== undefined);
  const denied = decisions.find(decision => !decision.allowed);
  if (denied === undefined) return null;

  return {
    status: 429,
    headers: {
      "Retry-After": String(Math.max(1, Math.ceil(denied.retryAfterMs / 1_000))),
    },
    body: {
      error: {
        code: "auth_rate_limited",
        message: "Too many attempts. Try again later.",
      },
    },
  };
};

const knownError = (
  status: number,
  code: string,
  message: string,
): PlatformHttpResponse<PlatformHttpErrorBody> => ({
  status,
  body: {
    error: {
      code,
      message,
    },
  },
});

const platformErrorStatus = (code: PlatformAppError["code"]): number => {
  switch (code) {
    case "auth_required":
      return 401;
    case "draft_room_not_final":
    case "team_claim_locked":
      return 409;
    case "league_not_found":
    case "historical_import_not_found":
    case "pricing_snapshot_not_found":
    case "season_not_found":
    case "team_not_found":
      return 404;
    case "team_already_claimed":
      return 409;
    case "membership_required":
    case "private_resource":
    case "private_team_required":
    case "shared_mutation_denied":
    case "team_claim_required":
      return 403;
  }
};

const mockSessionErrorStatus = (code: MockDraftSessionError["code"]): number => {
  switch (code) {
    case "access_denied":
      return 403;
    case "session_not_found":
      return 404;
    case "command_idempotency_conflict":
    case "session_not_reusable":
    case "session_not_writable":
    case "stale_command_count":
    case "stale_revision":
      return 409;
    case "command_key_required":
    case "command_required":
    case "mock_count_required":
    case "owner_required":
    case "team_required":
      return 400;
  }
};

const snakeDraftErrorStatus = (code: SnakeDraftError["code"]): number => {
  switch (code) {
    case "draft_incomplete":
    case "duplicate_player":
    case "invalid_status":
    case "no_pick_to_undo":
    case "not_human_turn":
    case "roster_limit":
    case "stale_revision":
      return 409;
    case "invalid_config":
    case "invalid_keeper":
    case "player_not_found":
      return 400;
  }
};

const auctionMockErrorStatus = (code: GenericAuctionMockError["code"]): number => {
  switch (code) {
    case "draft_incomplete":
    case "duplicate_player":
    case "invalid_decision":
    case "invalid_status":
    case "max_bid_exceeded":
    case "no_decision_to_undo":
    case "no_eligible_player":
    case "position_limit":
    case "roster_full":
    case "roster_limit":
    case "stale_revision":
      return 409;
    case "invalid_config":
    case "invalid_keeper":
    case "invalid_price":
    case "player_not_found":
    case "team_not_found":
      return 400;
  }
};

const simulationErrorStatus = (code: SimulationError["code"]): number => {
  switch (code) {
    case "simulation_not_found":
      return 404;
    case "idempotency_conflict":
      return 409;
    case "duplicate_hard_lock":
    case "invalid_count":
    case "invalid_hard_lock_price":
    case "invalid_soft_target_candidate_pool":
    case "invalid_soft_target_label":
    case "invalid_soft_target_max_bid":
    case "missing_hard_lock_player":
      return 400;
  }
};

const liveDraftRoomErrorStatus = (code: LiveDraftRoomError["code"]): number => {
  switch (code) {
    case "access_denied":
    case "mutation_denied":
      return 403;
    case "room_not_found":
      return 404;
    case "duplicate_player":
    case "draft_incomplete":
    case "idempotency_conflict":
    case "max_bid_exceeded":
    case "no_sale_to_undo":
    case "position_limit":
    case "room_already_ended":
    case "room_already_exists":
    case "room_already_live":
    case "room_not_live":
    case "room_not_cancellable":
    case "room_not_paused":
    case "room_paused":
    case "roster_full":
    case "sale_not_active":
    case "season_not_ready":
    case "stale_revision":
      return 409;
    case "expected_revision_required":
    case "idempotency_key_required":
    case "invalid_sale_price":
    case "owner_not_found":
    case "player_not_found":
    case "team_not_found":
      return 400;
  }
};

const draftExportErrorStatus = (code: DraftExportError["code"]): number => {
  switch (code) {
    case "duplicate_player":
      return 409;
    case "invalid_price":
    case "invalid_slot":
      return 400;
  }
};

const jobErrorStatus = (code: JobError["code"]): number => {
  switch (code) {
    case "job_not_found":
      return 404;
    case "idempotency_key_required":
      return 400;
    case "idempotency_conflict":
      return 409;
    case "job_lock_mismatch":
    case "job_owner_required":
      return 403;
    case "job_not_claimable":
    case "job_not_running":
    case "job_not_terminal":
      return 409;
  }
};

const historicalImportErrorStatus = (code: HistoricalImportError["code"]): number => {
  switch (code) {
    case "batch_not_found":
      return 404;
    case "batch_blocked":
    case "season_import_conflict":
      return 409;
  }
};

const platformInvitationErrorStatus = (code: PlatformInvitationError["code"]): number => {
  switch (code) {
    case "invitation_not_found":
      return 404;
    case "invitation_email_mismatch":
      return 403;
    case "invitation_expired":
      return 410;
    case "invitation_unavailable":
      return 409;
  }
};

const errorResponseFor = (error: unknown): PlatformHttpResponse<PlatformHttpErrorBody> => {
  if (error instanceof URIError) {
    return knownError(400, "invalid_request", "Request path is invalid.");
  }

  if (error instanceof AuthError) {
    const status = error.code === "auth_required"
      ? 401
      : error.code === "invalid_current_password" || error.code === "email_unverified"
        ? 403
        : error.code === "duplicate_email" || error.code === "password_change_conflict"
          ? 409
          : 400;
    return knownError(status, error.code, error.message);
  }

  if (error instanceof PlatformAppError) {
    return knownError(platformErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof MockDraftSessionError) {
    return knownError(mockSessionErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof SeasonMockConfigurationSnapshotError) {
    return knownError(
      error.code === "snapshot_migration_required" ? 409 : 400,
      error.code,
      error.message,
    );
  }

  if (error instanceof SeasonSnakeMockError) {
    const status = error.code === "human_team_missing"
      ? 403
      : error.code === "invalid_command_log"
        ? 400
        : 409;
    return knownError(status, error.code, error.message);
  }

  if (error instanceof SeasonAuctionMockError) {
    const status = error.code === "human_team_missing"
      ? 403
      : error.code === "invalid_command_log"
        ? 400
        : 409;
    return knownError(status, error.code, error.message);
  }

  if (error instanceof SnakeDraftError) {
    return knownError(snakeDraftErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof GenericAuctionMockError) {
    return knownError(auctionMockErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof SeasonSimulationError) {
    const status = error.code === "human_team_missing"
      ? 403
      : error.code === "invalid_configuration"
        ? 409
        : error.code === "simulation_busy" || error.code === "simulation_timeout"
          ? 503
          : error.code === "simulation_canceled"
            ? 408
        : error.code === "simulation_failed"
          ? 500
          : 400;
    const response = knownError(status, error.code, error.message);
    return error.code === "simulation_busy"
      ? { ...response, headers: { "Retry-After": "5" } }
      : response;
  }

  if (error instanceof SimulationError) {
    return knownError(simulationErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof LiveDraftRoomError) {
    return knownError(liveDraftRoomErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof DraftExportError) {
    return knownError(draftExportErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof JobError) {
    return knownError(jobErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof ExportArtifactError) {
    return knownError(409, error.code, error.message);
  }

  if (error instanceof HistoricalImportError) {
    return knownError(historicalImportErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof HistoricalImportTargetError) {
    return knownError(409, error.code, error.message);
  }

  if (error instanceof HistoricalSpreadsheetUploadError) {
    return knownError(400, "invalid_historical_upload", error.message);
  }

  if (error instanceof SeasonKeeperSetupError) {
    return knownError(409, error.code, error.message);
  }

  if (error instanceof PostDraftLiveRoomAdapterError) {
    const status = error.code === "private_owner_mismatch" || error.code === "owned_team_mismatch"
      ? 403
      : 409;
    return knownError(status, error.code, error.message);
  }

  if (error instanceof PricingSnapshotError) {
    return knownError(409, error.code, error.message);
  }

  if (error instanceof PlatformInvitationError) {
    return knownError(platformInvitationErrorStatus(error.code), error.code, error.message);
  }

  if (error instanceof LeagueMembersScreenshotAnalyzerError) {
    return knownError(
      error.code === "invalid_image" ? 400 : error.code === "provider_unavailable" ? 503 : 422,
      error.code,
      error.message,
    );
  }

  if (error instanceof LeagueSetupWriteConflictError) {
    return knownError(409, "league_setup_write_conflict", error.message);
  }

  if (error instanceof LiveDraftRoomSetupWriteConflictError) {
    return knownError(409, "draft_setup_write_conflict", error.message);
  }

  if (error instanceof LeagueCreationError) {
    return knownError(400, "invalid_league_setup", error.message);
  }

  return {
    status: 500,
    body: {
      error: {
        code: "internal_error",
        message: "Something went wrong.",
      },
    },
  };
};

const registerSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  expectedSeasonId?: string | undefined,
): Promise<PlatformHttpResponse> => {
  const seasonInput = unknownRecord(request.body.season);
  if (expectedSeasonId !== undefined && optionalString(seasonInput?.id) !== expectedSeasonId) {
    return knownError(
      400,
      "season_id_mismatch",
      "Season body must match the route season id.",
    );
  }

  const season = await app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: request.body.season as LeagueSeason,
    memberships: arrayValue(request.body.memberships) as readonly PlatformLeagueMembership[],
    now: request.now,
  });

  return { status: 200, body: { season } };
};

const setupImportKnownUsers = (value: unknown): readonly PlatformLeagueSetupImportKnownUser[] =>
  arrayValue(value).flatMap((candidate): PlatformLeagueSetupImportKnownUser[] => {
    const record = unknownRecord(candidate);
    const email = optionalString(record?.email);
    if (record === null || email === undefined) return [];
    const userId = optionalString(record.userId);
    const accountId = optionalString(record.accountId);

    return [{
      email,
      ...(userId === undefined ? {} : { userId }),
      ...(accountId === undefined ? {} : { accountId }),
    }];
  });

const screenshotConfidence = (value: unknown): LeagueMembersScreenshotConfidence =>
  value === "high" || value === "medium" || value === "low" ? value : "low";

const leagueMembersScreenshotImportInput = (
  body: Record<string, unknown>,
): LeagueMembersScreenshotImportInput => ({
  leagueName: optionalString(body.leagueName) ?? null,
  externalLeagueId: optionalString(body.externalLeagueId) ?? null,
  teams: arrayValue(body.teams).map(candidate => {
    const team = unknownRecord(candidate) ?? {};

    return {
      draftOrderPosition: optionalNumber(team.draftOrderPosition) ?? 0,
      abbreviation: optionalString(team.abbreviation) ?? "",
      teamDisplayName: optionalString(team.teamDisplayName) ?? "",
      managerDisplayNames: stringArrayValue(team.managerDisplayNames),
      confidence: screenshotConfidence(team.confidence),
      issues: stringArrayValue(team.issues),
      confirmed: optionalBoolean(team.confirmed) ?? false,
      targetTeamId: optionalString(team.targetTeamId) ?? null,
    };
  }),
});

const screenshotRateLimitResponse = (
  request: ParsedPlatformHttpRequest,
  limiter: ClientAddressRateLimiter | undefined,
  key: string,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => {
  const decision = limiter?.consume(key, request.now);
  if (decision === undefined || decision.allowed) return null;

  return {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))) },
    body: {
      error: {
        code: "rate_limited",
        message: "Too many screenshot analyses. Try again later.",
      },
    },
  };
};

const actionRateLimitResponse = (
  request: ParsedPlatformHttpRequest,
  limiter: ClientAddressRateLimiter | undefined,
  key: string,
  message: string,
): PlatformHttpResponse<PlatformHttpErrorBody> | null => {
  const decision = limiter?.consume(key, request.now);
  if (decision === undefined || decision.allowed) return null;

  return {
    status: 429,
    headers: { "Retry-After": String(Math.max(1, Math.ceil(decision.retryAfterMs / 1_000))) },
    body: { error: { code: "rate_limited", message } },
  };
};

const routeSeasonSetupImport = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: Pick<
    PlatformHttpServices,
    "invitationRepository" | "leagueMembersScreenshotAnalyzer" | "screenshotImportRateLimiter"
  >,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  const content = optionalString(request.body.content);
  const now = request.now;
  const input: PlatformLeagueSetupImportInput = {
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    rows: stringArrayValue(request.body.rows),
    knownUsers: setupImportKnownUsers(request.body.knownUsers),
    ...(content === undefined ? {} : { content }),
    ...(now === undefined ? {} : { now }),
    ...(services.invitationRepository === undefined ? {} : { invitationRepository: services.invitationRepository }),
  };

  if (action === "preview") return await previewLeagueSetupImport(app, input);
  if (action === "apply") return await applyLeagueSetupImport(app, input);
  if (action === "screenshot-analyze") {
    const account = await requireSeasonManager(app, request, seasonId ?? "");
    const analyzer = services.leagueMembersScreenshotAnalyzer;
    if (analyzer === undefined) {
      return knownError(
        503,
        "screenshot_import_unavailable",
        "Screenshot import is not configured for this deployment.",
      );
    }
    const limited = screenshotRateLimitResponse(
      request,
      services.screenshotImportRateLimiter,
      `${account.id}:${seasonId ?? ""}`,
    );
    if (limited !== null) return limited;

    return await analyzeLeagueMembersScreenshot(app, {
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      image: {
        mimeType: optionalString(request.body.mimeType) ?? "",
        base64: optionalString(request.body.base64) ?? "",
      },
      analyzer,
      now,
    });
  }
  if (action === "screenshot-apply") {
    await requireSeasonManager(app, request, seasonId ?? "");
    const setupRevision = optionalString(request.body.setupRevision);

    return await applyLeagueMembersScreenshotImport(app, {
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      ...(setupRevision === undefined ? {} : { setupRevision }),
      import: leagueMembersScreenshotImportInput(request.body),
      now,
    });
  }

  return notFound();
};

const historicalOwnerMappingsFrom = (value: unknown): readonly HistoricalOwnerMapping[] =>
  arrayValue(value).map(mappingValue => {
    const mapping = unknownRecord(mappingValue);
    if (mapping === null) {
      throw new HistoricalImportTargetError("Historical owner mappings must be objects.");
    }

    return {
      sourceOwnerOrTeamLabel: stringValue(mapping.sourceOwnerOrTeamLabel),
      teamId: stringValue(mapping.teamId),
    };
  });

const historicalPlayerMappingsFrom = (value: unknown): readonly { rowNumber: number; playerId: string }[] =>
  arrayValue(value).flatMap(candidate => {
    const mapping = unknownRecord(candidate);
    const rowNumber = optionalNumber(mapping?.rowNumber);
    const playerId = optionalString(mapping?.playerId);
    if (rowNumber === undefined || !Number.isSafeInteger(rowNumber) || rowNumber < 1 || playerId === undefined) {
      return [];
    }

    return [{ rowNumber, playerId }];
  });

const historicalDraftSetupFor = async (
  season: LeagueSeason,
  services: PlatformHttpServices,
  now: Date,
): Promise<LiveDraftRoomSetup | null> => {
  const storedSetup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  if (storedSetup !== null) return storedSetup;
  const fallbackSetup = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  const playerCatalog = fallbackSetup?.playerCatalog
    ?? await services.currentPlayerCatalogProvider?.()
    ?? null;
  if (playerCatalog !== null) {
    const setupInput = {
      seasonId: season.id,
      sourceVersion: `current-catalog-${season.seasonYear}`,
      playerCatalog,
      initialRosters: fallbackSetup?.initialRosters ?? [],
      updatedAt: now,
    };

    return {
      ...setupInput,
      contentHash: liveDraftRoomSetupContentHash(setupInput),
    };
  }

  return null;
};

const routeSeasonHistoricalImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (action !== "preview" && action !== "upload-preview") return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  await requireSeasonManager(app, request, seasonId ?? "");
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    now: request.now,
  });
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(
      409,
      "historical_import_locked",
      "Draft history is locked after the live draft starts.",
    );
  }
  const sourceText = action === "upload-preview"
    ? await historicalSpreadsheetUploadToSourceText({
        fileName: stringValue(request.body.fileName),
        mimeType: stringValue(request.body.mimeType),
        base64: stringValue(request.body.base64),
      })
    : optionalString(request.body.sourceText)
      ?? optionalString(request.body.content)
      ?? "";
  const historicalSetup = await historicalDraftSetupFor(
    season,
    services,
    request.now ?? new Date(),
  );
  const result = await app.previewHistoricalImportSource({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: optionalNumber(request.body.seasonYear) ?? season.seasonYear,
    currentSeasonId: season.id,
    sourceText,
    inferFirstRosterRowAsKeeper: optionalBoolean(request.body.inferFirstRosterRowAsKeeper),
    replacementRequested: optionalBoolean(request.body.replacementRequested),
    ...(historicalSetup === null ? {} : { playerCatalog: historicalSetup.playerCatalog }),
    ownerMappings: historicalOwnerMappingsFrom(request.body.ownerMappings),
    requireCompleteTeamMapping: optionalBoolean(request.body.requireCompleteTeamMapping),
    playerMappings: historicalPlayerMappingsFrom(request.body.playerMappings),
    now: request.now,
  });

  return { status: 200, body: result };
};

const routeSeasonPricing = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, seasonAction, action] = request.segments;
  const now = request.now;
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    now,
  });

  if (seasonAction === "pricing" && action === "rebuild" && request.segments.length === 4) {
    if (request.method !== "POST") return methodNotAllowed();

    const result = await app.rebuildLeaguePricing({
      actorSessionToken: request.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelVersion: stringValue(request.body.modelVersion),
      scenarioIds: stringArrayValue(request.body.scenarioIds),
      baselinePrices: arrayValue(request.body.baselinePrices) as readonly PricingSourcePrice[],
      now,
    });

    return { status: 201, body: result };
  }

  if (seasonAction === "pricing-snapshots" && request.segments.length === 3) {
    if (request.method !== "GET") return methodNotAllowed();

    const pricingSnapshots = await app.listLeaguePricingSnapshots({
      actorSessionToken: request.sessionToken,
      leagueId: season.leagueId,
      seasonYear: season.seasonYear,
      modelRunId: optionalString(request.query.modelRunId),
      scenarioId: optionalString(request.query.scenarioId),
      now,
    });

    return { status: 200, body: { pricingSnapshots } };
  }

  return notFound();
};

const seasonDraftSetupForKeeperEditing = async (
  season: LeagueSeason,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<{
  setup: LiveDraftRoomSetup;
  expectedContentHash: string | null;
} | PlatformHttpResponse> => {
  if (services.liveDraftRoomSetupRepository === undefined) {
    return knownError(503, "keeper_setup_unavailable", "Keeper setup is unavailable.");
  }
  const repository = services.liveDraftRoomSetupRepository;
  const stored = await repository.findForSeason(season.id);
  if (stored !== null) return { setup: stored, expectedContentHash: stored.contentHash };
  const fallback = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  if (fallback === null) {
    return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
  }
  const setupInput = {
    seasonId: season.id,
    sourceVersion: `current-catalog-${season.seasonYear}`,
    playerCatalog: fallback.playerCatalog,
    initialRosters: fallback.initialRosters,
    updatedAt: request.now ?? new Date(),
  };

  return {
    setup: {
      ...setupInput,
      contentHash: liveDraftRoomSetupContentHash(setupInput),
    },
    expectedContentHash: null,
  };
};

const isPlatformHttpResponse = (
  value: object,
): value is PlatformHttpResponse => "status" in value;

const rebuildPricingAfterKeeperChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
  options: {
    preflight?: boolean;
    historicalSaleRecords?: readonly HistoricalSaleRecord[];
    modelVersion?: string;
  } = {},
): Promise<PreflightLeaguePricingWorkflowResult | RebuildLeaguePricingWorkflowResult | undefined> => {
  if (season.settings.draftFormat === "snake") return undefined;
  const keepers = listSeasonKeepers(setup);
  const keeperPlayerKeys = new Set(keepers.map(keeper => canonicalPlayerIdentityKey(keeper.playerName)));

  const input = {
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    modelVersion: options.modelVersion ?? "league-history-keepers-v2",
    scenarioIds: ["expected"],
    baselinePrices: setup.playerCatalog
      .filter(player => !keeperPlayerKeys.has(canonicalPlayerIdentityKey(player.name)))
      .map(player => ({
        name: player.name,
        normalizedName: canonicalPlayerIdentityKey(player.name),
        position: player.position,
        price: player.marketPrice ?? player.expectedPrice,
      })),
    currentKeeperCount: keepers.length,
    keeperLockedSpend: keepers.reduce((total, keeper) => total + keeper.price, 0),
    now: request.now,
    ...(options.historicalSaleRecords === undefined
      ? {}
      : { historicalSaleRecords: options.historicalSaleRecords }),
  };

  return options.preflight === true
    ? await app.preflightLeaguePricing(input)
    : await app.rebuildLeaguePricing(input);
};

const playerCatalogWithPricingSnapshot = (
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  snapshot: PricingSnapshot | undefined,
): readonly LiveDraftRoomPlayerCatalogEntry[] => {
  if (snapshot === undefined) return playerCatalog;
  const rowsByPlayer = new Map(
    snapshot.rows.map(row => [canonicalPlayerIdentityKey(row.playerName), row]),
  );

  return playerCatalog.map(player => {
    const pricing = rowsByPlayer.get(canonicalPlayerIdentityKey(player.name));
    if (pricing === undefined) return player;

    return {
      ...player,
      marketPrice: pricing.marketPrice,
      expectedPrice: Math.max(1, Math.round(pricing.scenarioPrice)),
    };
  });
};

const synchronizeUnopenedLiveRoomAfterKeeperChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  setup: LiveDraftRoomSetup,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
  idempotencyKey = `keepers:${setup.contentHash}:${setup.updatedAt.toISOString()}`,
  expectedRevision?: number,
) => await app.synchronizeLiveDraftRoomInitialRosters({
  actorSessionToken: request.sessionToken,
  seasonId: season.id,
  initialRosters: setup.initialRosters,
  playerCatalog,
  idempotencyKey,
  ...(expectedRevision === undefined ? {} : { expectedRevision }),
  now: request.now,
});

const saveKeeperSetupAndSynchronizeLiveRoom = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  repository: LiveDraftRoomSetupRepository,
  previous: LiveDraftRoomSetup,
  proposed: LiveDraftRoomSetup,
  expectedContentHash: string | null,
  proposedRoomCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): Promise<{ saved: LiveDraftRoomSetup; room: LiveDraftRoom | null }> => {
  const saved = await repository.save(proposed, { expectedContentHash });

  try {
    return {
      saved,
      room: await synchronizeUnopenedLiveRoomAfterKeeperChange(
        app,
        request,
        season,
        saved,
        proposedRoomCatalog,
      ),
    };
  } catch (error) {
    await repository.save(previous, { expectedContentHash: saved.contentHash });
    throw error;
  }
};

const persistKeeperSetupChange = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  repository: LiveDraftRoomSetupRepository,
  previous: LiveDraftRoomSetup,
  proposed: LiveDraftRoomSetup,
  expectedContentHash: string | null,
): Promise<{
  saved: LiveDraftRoomSetup;
  room: LiveDraftRoom | null;
  pricing: RebuildLeaguePricingWorkflowResult | undefined;
}> => {
  const previousRoomCatalog = await liveRoomCatalogForSeason(
    app,
    request,
    season,
    previous.playerCatalog,
  );
  const pricingPreflight = await rebuildPricingAfterKeeperChange(
    app,
    request,
    season,
    proposed,
    { preflight: true },
  );
  const proposedRoomCatalog = playerCatalogWithPricingSnapshot(
    proposed.playerCatalog,
    pricingPreflight?.snapshots.at(-1),
  );
  const { saved, room } = await saveKeeperSetupAndSynchronizeLiveRoom(
    app,
    request,
    season,
    repository,
    previous,
    proposed,
    expectedContentHash,
    proposedRoomCatalog,
  );

  try {
    const pricingResult = await rebuildPricingAfterKeeperChange(app, request, season, saved);
    if (pricingResult !== undefined && !("savedSnapshotIds" in pricingResult)) {
      throw new Error("Keeper pricing rebuild returned an uncommitted preview.");
    }
    const pricing = pricingResult;
    return { saved, room, pricing };
  } catch (error) {
    if (room !== null) {
      await synchronizeUnopenedLiveRoomAfterKeeperChange(
        app,
        request,
        season,
        previous,
        previousRoomCatalog,
        `keepers-rollback:${saved.contentHash}:${previous.contentHash}`,
        room.revision,
      );
    }
    await repository.save(previous, { expectedContentHash: saved.contentHash });
    throw error;
  }
};

const routeSeasonKeepers = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 3 && request.segments.length !== 4) return notFound();
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    now: request.now,
  });
  const editableSetup = await seasonDraftSetupForKeeperEditing(season, request, services);
  if (isPlatformHttpResponse(editableSetup)) return editableSetup;
  const { setup, expectedContentHash } = editableSetup;
  const repository = services.liveDraftRoomSetupRepository;
  if (repository === undefined) {
    return knownError(503, "keeper_setup_unavailable", "Keeper setup is unavailable.");
  }

  if (request.segments.length === 3 && request.method === "GET") {
    return { status: 200, body: { keepers: listSeasonKeepers(setup) } };
  }

  await requireSeasonManager(app, request, season.id);
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(409, "keeper_setup_locked", "Keepers are locked after the live draft starts.");
  }

  if (request.segments.length === 4 && action === "preview") {
    if (request.method !== "POST") return methodNotAllowed();
    const result = previewSeasonKeeperCommand({
      season,
      playerCatalog: setup.playerCatalog,
      command: stringValue(request.body.command),
    });

    return { status: result.kind === "preview" ? 200 : 422, body: result };
  }

  if (request.segments.length === 4 && action === "apply") {
    if (request.method !== "POST") return methodNotAllowed();
    if (request.body.confirmed !== true) {
      return knownError(400, "keeper_confirmation_required", "Review and confirm this keeper before applying it.");
    }
    const preview = previewSeasonKeeperCommand({
      season,
      playerCatalog: setup.playerCatalog,
      command: stringValue(request.body.command),
    });
    if (preview.kind === "error") return { status: 422, body: preview };
    const proposedInput = applySeasonKeeperCommand({
      season,
      setup,
      preview,
      now: request.now,
    });
    const proposed = {
      ...proposedInput,
      contentHash: liveDraftRoomSetupContentHash(proposedInput),
      updatedAt: proposedInput.updatedAt ?? request.now ?? new Date(),
    };
    const { saved, room, pricing } = await persistKeeperSetupChange(
      app,
      request,
      season,
      repository,
      setup,
      proposed,
      expectedContentHash,
    );

    return {
      status: 200,
      body: {
        preview,
        keepers: listSeasonKeepers(saved),
        ...(room === null ? {} : { room }),
        ...(pricing === undefined ? {} : { pricing }),
      },
    };
  }

  if (request.segments.length === 3 && request.method === "DELETE") {
    const proposedInput = removeSeasonKeeper(setup, {
      teamId: stringValue(request.body.teamId),
      playerId: stringValue(request.body.playerId),
      now: request.now,
    });
    const proposed = {
      ...proposedInput,
      contentHash: liveDraftRoomSetupContentHash(proposedInput),
      updatedAt: proposedInput.updatedAt ?? request.now ?? new Date(),
    };
    const { saved, room, pricing } = await persistKeeperSetupChange(
      app,
      request,
      season,
      repository,
      setup,
      proposed,
      expectedContentHash,
    );

    return {
      status: 200,
      body: {
        keepers: listSeasonKeepers(saved),
        ...(room === null ? {} : { room }),
        ...(pricing === undefined ? {} : { pricing }),
      },
    };
  }

  return methodNotAllowed();
};

const liveRoomCatalogForSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  season: LeagueSeason,
  playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[],
): Promise<readonly LiveDraftRoomPlayerCatalogEntry[]> => {
  if (season.settings.draftFormat !== "auction") return playerCatalog;
  const snapshots = await app.listLeaguePricingSnapshots({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    scenarioId: "expected",
    now: request.now,
  });
  return playerCatalogWithPricingSnapshot(playerCatalog, snapshots.at(-1));
};

const routeSeason = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [seasonRoot, seasonId, seasonAction] = request.segments;
  if (seasonRoot !== "seasons") return notFound();

  if (request.segments.length === 1 && request.method === "POST") {
    if (!hasProvisioningAccess(request, services)) {
      return knownError(403, "provisioning_required", "League creation is restricted to deployment provisioning.");
    }
    return await registerSeason(app, request);
  }

  if (seasonAction === "setup-import") {
    return await routeSeasonSetupImport(app, request, services);
  }

  if (seasonAction === "historical-imports") {
    return await routeSeasonHistoricalImports(app, request, services);
  }

  if (seasonAction === "pricing" || seasonAction === "pricing-snapshots") {
    return await routeSeasonPricing(app, request);
  }

  if (seasonAction === "keepers") {
    return await routeSeasonKeepers(app, request, services);
  }

  if (seasonAction === "publish" && request.segments.length === 3) {
    if (request.method !== "POST") return methodNotAllowed();
    await requireSeasonManager(app, request, seasonId ?? "");
    const season = await app.getLeagueSeason({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      now: request.now,
    });
    if (season.setupStatus === "published") return { status: 200, body: { season } };
    if (request.body.confirmed !== true) {
      return knownError(
        400,
        "season_review_confirmation_required",
        "Review teams, scoring, roster rules, draft history, and keepers before publishing.",
      );
    }
    const readiness = assessLeagueSeasonReadiness(season);
    if (!readiness.canPublish) {
      return knownError(
        409,
        "season_not_ready",
        readiness.blockers[0] ?? "Resolve league setup blockers before publishing.",
      );
    }
    const publishedSeason = await app.registerLeagueSeason({
      actorSessionToken: request.sessionToken,
      season: { ...season, setupStatus: "published" },
      memberships: await app.listLeagueMemberships(season.leagueId),
      membershipWriteMode: "preserve",
      now: request.now,
    });

    return { status: 200, body: { season: publishedSeason } };
  }

  if (seasonAction === "live-room" && request.segments.length === 3) {
    await requireSeasonManager(app, request, seasonId ?? "");
    const season = await app.getLeagueSeason({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      now: request.now,
    });
    if (request.method === "DELETE") {
      const roomId = `room-${season.id}-real`;
      const room = await app.getLiveDraftRoom({
        actorSessionToken: request.sessionToken,
        roomId,
        now: request.now,
      });
      if (room.seasonId !== season.id) {
        return knownError(409, "season_room_mismatch", "That draft room does not belong to this season.");
      }
      await app.cancelLiveDraftRoom({
        actorSessionToken: request.sessionToken,
        roomId,
        expectedRevision: room.revision,
        idempotencyKey: `cancel:${roomId}:${room.revision}`,
        now: request.now,
      });

      return { status: 200, body: { ok: true } };
    }
    if (request.method !== "POST") return methodNotAllowed();
    if (season.settings.draftFormat === "snake") {
      return knownError(
        409,
        "snake_live_room_unavailable",
        "Hosted live rooms currently support auction drafts. Use Mock Draft for this snake league.",
      );
    }
    const startsAt = dateValue(request.body.startsAt);
    if (request.body.startsAt !== undefined && startsAt === undefined) {
      return knownError(400, "invalid_draft_time", "Choose a valid draft date and time.");
    }
    const storedSetup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
    const setup = storedSetup ?? await services.liveDraftRoomSetupProvider?.(season) ?? null;
    if (setup === null) {
      return knownError(
        409,
        "live_draft_setup_missing",
        "Publish this season's player catalog and keepers before creating its live room.",
      );
    }
    const playerCatalog = await liveRoomCatalogForSeason(app, request, season, setup.playerCatalog);
    const room = await app.createLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      seasonId: season.id,
      roomId: `room-${season.id}-real`,
      viewerPasswordHashRef: `account-membership:${season.id}`,
      ...(startsAt === undefined ? {} : { startsAt }),
      playerCatalog,
      initialRosters: setup.initialRosters,
      now: request.now,
    });

    return {
      status: 201,
      body: {
        room: await app.getLiveDraftRoomState({
          actorSessionToken: request.sessionToken,
          roomId: room.roomId,
          now: request.now,
        }),
      },
    };
  }

  if (seasonAction === "team-claims" && request.segments.length === 3) {
    if (request.method !== "POST") return methodNotAllowed();

    const membership = await app.claimLeagueSeasonTeam({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      ownerId: stringValue(request.body.ownerId),
      teamId: stringValue(request.body.teamId),
      now: request.now,
    });

    return { status: 200, body: { membership } };
  }

  if (request.segments.length !== 2) return notFound();

  if (request.method === "GET") {
    const season = await app.getLeagueSeason({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      now: request.now,
    });
    const claimedTeamIds = new Set(
      (await app.listLeagueMemberships(season.leagueId))
        .map(membership => membership.teamId)
        .filter((teamId): teamId is string => teamId !== undefined),
    );

    return {
      status: 200,
      body: {
        season,
        claimableTeams: season.teams.filter(team => !claimedTeamIds.has(team.id)),
      },
    };
  }

  if (request.method === "PUT") {
    return await registerSeason(app, request, seasonId);
  }

  return methodNotAllowed();
};

const routeSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, runId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method === "GET") {
      const simulations = await app.listSimulationRuns({
        actorSessionToken: request.sessionToken,
        now: request.now,
      });

      return { status: 200, body: { simulations } };
    }

    if (request.method === "POST") {
      const simulation = await app.createSimulationRun({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        count: optionalNumber(request.body.count) ?? Number.NaN,
        seedPrefix: stringValue(request.body.seedPrefix),
        idempotencyKey: stringValue(request.body.idempotencyKey),
        strategy: (request.body.strategy ?? {}) as SimulationStrategyInput,
        now: request.now,
      });

      return { status: 201, body: { simulation } };
    }

    return methodNotAllowed();
  }

  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const simulation = await app.getSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      now: request.now,
    });

    return { status: 200, body: { simulation } };
  }

  if (request.segments.length === 3 && action === "execute") {
    if (request.method !== "POST") return methodNotAllowed();
    const account = await requireRequestAccount(app, request);
    const limited = actionRateLimitResponse(
      request,
      services.simulationRateLimiter,
      `${account.id}:legacy-simulation`,
      "Too many simulation runs. Try again later.",
    );
    if (limited !== null) return limited;

    const simulation = await app.executeSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      now: request.now,
    });

    return { status: 200, body: { simulation } };
  }

  if (request.segments.length === 3 && (action === "jobs" || action === "enqueue")) {
    if (request.method !== "POST") return methodNotAllowed();

    const job = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 202, body: { job } };
  }

  return notFound();
};

const routeHistoricalImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, batchId, action] = request.segments;
  if (request.segments.length !== 3 || action !== "commit") return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  const seasonId = stringValue(request.body.seasonId).trim();
  const historicalSeasonYear = optionalNumber(request.body.seasonYear) ?? Number.NaN;
  if (seasonId.length === 0 || !Number.isInteger(historicalSeasonYear)) {
    return knownError(
      400,
      "historical_import_target_required",
      "Choose the league season and historical draft year before importing.",
    );
  }
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  if (await app.hasStartedLiveDraftRoomForSeason(season.id)) {
    return knownError(
      409,
      "historical_import_locked",
      "Draft history is locked after the live draft starts.",
    );
  }
  const setup = season.settings.draftFormat === "auction"
    ? await historicalDraftSetupFor(season, services, request.now ?? new Date())
    : null;

  const prepared = await app.prepareHistoricalImportCommit({
    actorSessionToken: request.sessionToken,
    batchId: batchId ?? "",
    expectedLeagueId: season.leagueId,
    expectedLeagueSeasonId: season.id,
    expectedSeasonYear: historicalSeasonYear,
    pricingSeasonYear: season.seasonYear,
    now: request.now,
  });

  if (season.settings.draftFormat !== "snake" && setup !== null) {
    await rebuildPricingAfterKeeperChange(app, request, season, setup, {
      preflight: true,
      historicalSaleRecords: prepared.projectedHistoricalSaleRecords,
      modelVersion: "league-history-v2",
    });
  }

  const result = await app.commitHistoricalImport({
    actorSessionToken: request.sessionToken,
    batchId: batchId ?? "",
    expectedLeagueId: season.leagueId,
    expectedLeagueSeasonId: season.id,
    expectedSeasonYear: historicalSeasonYear,
    now: request.now,
  });

  if (season.settings.draftFormat !== "snake" && setup !== null) {
    const pricingResult = await rebuildPricingAfterKeeperChange(app, request, season, setup, {
      modelVersion: "league-history-v2",
    });
    if (pricingResult === undefined || !("savedSnapshotIds" in pricingResult)) {
      throw new Error("Historical pricing rebuild did not persist a snapshot.");
    }
    const room = await synchronizeUnopenedLiveRoomAfterKeeperChange(
      app,
      request,
      season,
      setup,
      playerCatalogWithPricingSnapshot(setup.playerCatalog, pricingResult.snapshots.at(-1)),
      `history:${result.batch.id}:${pricingResult.modelRunId}`,
    );
    return {
      status: 200,
      body: {
        ...result,
        pricing: pricingResult,
        ...(room === null ? {} : { room }),
      },
    };
  }

  return { status: 200, body: result };
};

const routePricingSnapshots = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, modelRunId] = request.segments;
  if (request.segments.length !== 2) return notFound();
  if (request.method !== "GET") return methodNotAllowed();

  const pricingSnapshot = await app.getPricingSnapshot({
    actorSessionToken: request.sessionToken,
    modelRunId: modelRunId ?? "",
    scenarioId: optionalString(request.query.scenarioId),
    now: request.now,
  });

  return { status: 200, body: { pricingSnapshot } };
};

const routeJobs = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, jobId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method !== "GET") return methodNotAllowed();

    const jobs = await app.listJobs({
      actorSessionToken: request.sessionToken,
      now: request.now,
    });

    return { status: 200, body: { jobs } };
  }

  if (request.segments.length === 3 && action === "cancel") {
    if (request.method !== "POST") return methodNotAllowed();

    const job = await app.cancelJob({
      actorSessionToken: request.sessionToken,
      jobId: jobId ?? "",
      now: request.now,
    });

    return { status: 200, body: { job } };
  }

  if (request.segments.length === 3 && action === "rerun") {
    if (request.method !== "POST") return methodNotAllowed();

    const job = await app.rerunJob({
      actorSessionToken: request.sessionToken,
      jobId: jobId ?? "",
      idempotencyKey: stringValue(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 202, body: { job } };
  }

  if (request.segments.length !== 2) return notFound();
  if (request.method !== "GET") return methodNotAllowed();

  const job = await app.getJob({
    actorSessionToken: request.sessionToken,
    jobId: jobId ?? "",
    now: request.now,
  });

  return { status: 200, body: { job } };
};

const routeMockSessions = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, sessionId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method === "GET") {
      const mockSessions = await app.listMockDraftSessions({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.query.leagueId),
        seasonId: stringValue(request.query.seasonId),
        ownerId: stringValue(request.query.ownerId),
        teamId: optionalString(request.query.teamId),
        now: request.now,
      });

      return { status: 200, body: { mockSessions } };
    }

    if (request.method === "POST") {
      const status = request.body.status === "setup" || request.body.status === "active"
        ? request.body.status
        : undefined;
      const mockSession = await app.createMockDraftSession({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        draftMode: request.body.draftMode as MockDraftModeMetadata,
        status,
        now: request.now,
      });

      return { status: 201, body: { mockSession } };
    }

    return methodNotAllowed();
  }

  if (request.segments.length !== 3) return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  if (action === "commands" || action === "append") {
    const mockSession = await app.appendMockDraftCommand({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      expectedCommandCount: optionalNumber(request.body.expectedCommandCount) ?? Number.NaN,
      commandId: stringValue(request.body.commandId),
      command: stringValue(request.body.command),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      latestResultRef: mockDraftResultReferenceFor(request.body.latestResultRef),
      now: request.now,
    });

    return { status: 200, body: { mockSession } };
  }

  if (action === "reset") {
    const mockSession = await app.resetMockDraftSession({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      now: request.now,
    });

    return { status: 200, body: { mockSession } };
  }

  return notFound();
};

interface SeasonMockDraftContext {
  membership: PlatformLeagueMembership & { ownerId: string; teamId: string };
  season: LeagueSeason;
  setup: LiveDraftRoomSetup;
}

const withCurrentProjectionFields = async (
  setup: LiveDraftRoomSetup,
  currentPlayerCatalogProvider: PlatformHttpServices["currentPlayerCatalogProvider"],
): Promise<LiveDraftRoomSetup> => {
  if (currentPlayerCatalogProvider === undefined) return setup;

  const currentCatalog = await currentPlayerCatalogProvider();
  const currentPlayersByIdentity = new Map(
    currentCatalog.map(player => [canonicalPlayerIdentityKey(player.name), player]),
  );
  return {
    ...setup,
    playerCatalog: setup.playerCatalog.map(player => {
      const current = currentPlayersByIdentity.get(canonicalPlayerIdentityKey(player.name));
      if (current === undefined) return player;
      return {
        ...player,
        ...(current.week1Projection === undefined
          ? {}
          : { week1Projection: current.week1Projection }),
        ...(current.weeks1To4Projection === undefined
          ? {}
          : { weeks1To4Projection: current.weeks1To4Projection }),
        ...(current.seasonProjection === undefined
          ? {}
          : { seasonProjection: current.seasonProjection }),
      };
    }),
  };
};

const seasonMockConfigurationSnapshotFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
  strategyKey: LiveDraftStrategyKey,
): Promise<SeasonMockConfigurationSnapshotV2> => {
  const snapshots = context.season.settings.draftFormat === "auction"
    ? await app.listLeaguePricingSnapshots({
        actorSessionToken: request.sessionToken,
        leagueId: context.season.leagueId,
        seasonYear: context.season.seasonYear,
        scenarioId: "expected",
        now: request.now,
      })
    : [];
  const marketPrices = new Map(
    (snapshots.at(-1)?.rows ?? []).map(row => [
      canonicalPlayerIdentityKey(row.playerName),
      row.marketPrice,
    ]),
  );
  const humanKeepers = context.setup.initialRosters.filter(player =>
    player.source === "keeper" && player.teamId === context.membership.teamId
  );
  const positionCounts = humanKeepers.reduce<Record<string, number>>((counts, keeper) => {
    counts[keeper.position] = (counts[keeper.position] ?? 0) + 1;
    return counts;
  }, {});
  const flexTarget = ["RB", "WR", "TE"].reduce(
    (total, position) => total + Number(context.season.settings.roster.lineup[position] ?? 0),
    Number(context.season.settings.roster.lineup.FLEX ?? 0),
  );
  const currentFlexPlayers = ["RB", "WR", "TE"].reduce(
    (total, position) => total + (positionCounts[position] ?? 0),
    0,
  );
  const isAuction = context.season.settings.draftFormat === "auction";
  const budget = isAuction ? context.season.settings.auction.budgetDollars : 1;
  const minimumBid = isAuction ? context.season.settings.auction.minimumBidDollars : 1;
  const budgetRemaining = budget - humanKeepers.reduce((total, keeper) => total + keeper.price, 0);
  const openRosterSlots = Math.max(0, context.season.settings.roster.rosterSize - humanKeepers.length);
  const humanMaximumBid = Math.max(
    0,
    budgetRemaining - Math.max(0, openRosterSlots - 1) * minimumBid,
  );
  const playerExpectedPrices = Object.fromEntries(context.setup.playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    const marketValue = marketPrices.get(playerKey) ?? player.marketPrice ?? player.expectedPrice;
    return [playerKey, marketValue];
  }));
  const playerHumanValues = Object.fromEntries(context.setup.playerCatalog.map(player => {
    const playerKey = canonicalPlayerIdentityKey(player.name);
    const marketValue = marketPrices.get(playerKey) ?? player.marketPrice ?? player.expectedPrice;
    return [playerKey, isAuction ? strategyAdjustedAuctionValue({
      marketValue,
      position: player.position,
      strategyKey,
      positionCount: positionCounts[player.position] ?? 0,
      starterCount: Number(context.season.settings.roster.lineup[player.position] ?? 0),
      flexNeedsPlayer: currentFlexPlayers < flexTarget,
      maximumBid: humanMaximumBid,
    }) : marketValue];
  }));
  return createSeasonMockConfigurationSnapshot({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    playerExpectedPrices,
    playerHumanValues,
    capturedAt: request.now,
  });
};

const seasonMockDraftSetupFor = async (
  season: LeagueSeason,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<LiveDraftRoomSetup | PlatformHttpResponse> => {
  const stored = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
  if (stored !== null) {
    return withCurrentProjectionFields(stored, services.currentPlayerCatalogProvider);
  }
  const fallback = await services.liveDraftRoomSetupProvider?.(season) ?? null;
  if (fallback === null) {
    return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
  }
  const setupInput = {
    seasonId: season.id,
    sourceVersion: `current-catalog-${season.seasonYear}`,
    playerCatalog: fallback.playerCatalog,
    initialRosters: fallback.initialRosters,
    updatedAt: request.now ?? new Date(),
  };

  return {
    ...setupInput,
    contentHash: liveDraftRoomSetupContentHash(setupInput),
  };
};

const seasonMockDraftContextFor = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
  seasonId: string,
): Promise<SeasonMockDraftContext | PlatformHttpResponse> => {
  const account = await requireRequestAccount(app, request);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.ownerId === undefined || membership.teamId === undefined) {
    throw new PlatformAppError("team_claim_required", "Claim your team before starting a mock draft.");
  }
  const setup = await seasonMockDraftSetupFor(season, request, services);
  if (isPlatformHttpResponse(setup)) return setup;

  return {
    membership: { ...membership, ownerId: membership.ownerId, teamId: membership.teamId },
    season,
    setup,
  };
};

const isSeasonMockDraftContext = (
  value: SeasonMockDraftContext | PlatformHttpResponse,
): value is SeasonMockDraftContext => "membership" in value;

const findSeasonMockDraftSession = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  context: SeasonMockDraftContext,
  sessionId: string,
): Promise<MockDraftSession> => {
  const sessions = await app.listMockDraftSessions({
    actorSessionToken: request.sessionToken,
    leagueId: context.season.leagueId,
    seasonId: context.season.id,
    ownerId: context.membership.ownerId,
    teamId: context.membership.teamId,
    now: request.now,
  });
  const session = sessions.find(candidate => candidate.id === sessionId);
  if (session === undefined) {
    throw new MockDraftSessionError("session_not_found", "Mock draft session was not found.");
  }

  return session;
};

const snakeStateForSeasonMock = (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  additionalCommand?: string,
): SnakeDraftState => {
  const config = buildSeasonSnakeMockConfig({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    sessionId: session.id,
    seed: session.id,
  });
  const commandLog = session.commandLog.map(command => command.command);

  return replaySeasonSnakeMockCommands(
    config,
    additionalCommand === undefined ? commandLog : [...commandLog, additionalCommand],
  );
};

const auctionStateForSeasonMock = async (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  playerExpectedPrices: Readonly<Record<string, number>>,
  playerHumanValues: Readonly<Record<string, number>>,
  additionalCommand?: string,
): Promise<GenericAuctionMockState> => {
  const config = buildSeasonAuctionMockConfig({
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    sessionId: session.id,
    seed: session.id,
    playerExpectedPrices,
    playerHumanValues,
  });
  const commandLog = session.commandLog.map(command => command.command);

  return replaySeasonAuctionMockCommands(
    config,
    additionalCommand === undefined ? commandLog : [...commandLog, additionalCommand],
  );
};

const stateForSeasonMock = async (
  context: SeasonMockDraftContext,
  session: MockDraftSession,
  additionalCommand?: string,
): Promise<SnakeDraftState | GenericAuctionMockState> => {
  const snapshot = seasonMockReplayConfiguration(session.configurationSnapshot);
  const replayContext = {
    ...context,
    membership: { ...context.membership, teamId: snapshot.humanTeamId },
    season: snapshot.season,
    setup: snapshot.setup,
  };
  return snapshot.season.settings.draftFormat === "snake"
    ? snakeStateForSeasonMock(replayContext, session, additionalCommand)
    : await auctionStateForSeasonMock(
        replayContext,
        session,
        snapshot.playerExpectedPrices,
        snapshot.playerHumanValues,
        additionalCommand,
      );
};

const seasonMockResponseBody = (
  mockSession: MockDraftSession,
  state: SnakeDraftState | GenericAuctionMockState,
) => ({
  mockSession,
  state,
  ...(state.session.status === "completed"
    ? { results: buildSeasonMockResults(state) }
    : {}),
});

const serializedSeasonMockCommand = (value: unknown): string => {
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new SeasonSnakeMockError("invalid_command_log", "Snake mock command log is invalid.");
  }

  return serialized;
};

const routeSeasonMockDrafts = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, sessionId, action] = request.segments;
  const seasonId = request.segments.length === 1
    ? stringValue(request.body.seasonId)
    : request.method === "GET"
      ? stringValue(request.query.seasonId)
      : stringValue(request.body.seasonId);
  const context = await seasonMockDraftContextFor(app, request, services, seasonId);
  if (!isSeasonMockDraftContext(context)) return context;

  if (request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    const strategyKey = parseLiveDraftStrategyKey(optionalString(request.body.strategy) ?? "balanced");
    const strategy = liveDraftStrategies[strategyKey];
    const mockSession = await app.createMockDraftSession({
      actorSessionToken: request.sessionToken,
      leagueId: context.season.leagueId,
      seasonId: context.season.id,
      ownerId: context.membership.ownerId,
      teamId: context.membership.teamId,
      draftMode: {
        format: context.season.settings.draftFormat,
        mockCount: 1,
        label: `${context.season.league.name} ${strategy.label} mock draft`,
      },
      configurationSnapshot: await seasonMockConfigurationSnapshotFor(app, request, context, strategyKey),
      status: "setup",
      now: request.now,
    });

    const state = await stateForSeasonMock(context, mockSession);
    return { status: 201, body: seasonMockResponseBody(mockSession, state) };
  }

  const mockSession = await findSeasonMockDraftSession(app, request, context, sessionId ?? "");
  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const state = await stateForSeasonMock(context, mockSession);
    return { status: 200, body: seasonMockResponseBody(mockSession, state) };
  }

  if (request.segments.length === 3 && action === "commands") {
    if (request.method !== "POST") return methodNotAllowed();
    const command = serializedSeasonMockCommand(request.body.command);
    const commandId = stringValue(request.body.commandId).trim();
    const idempotencyKey = optionalString(request.body.idempotencyKey)?.trim() || commandId;
    const storedRetry = await app.findStoredMockDraftCommandForRetry({
      actorSessionToken: request.sessionToken,
      sessionId: mockSession.id,
      commandId,
      command,
      idempotencyKey,
      now: request.now,
    });
    if (storedRetry !== undefined) {
      const state = await stateForSeasonMock(context, storedRetry.session);
      return {
        status: 200,
        body: seasonMockResponseBody(storedRetry.session, state),
      };
    }
    const state = await stateForSeasonMock(context, mockSession, command);
    let updatedMockSession = await app.appendMockDraftCommand({
      actorSessionToken: request.sessionToken,
      sessionId: mockSession.id,
      expectedRevision: mockSession.revision,
      expectedCommandCount: mockSession.commandLog.length,
      commandId,
      command,
      idempotencyKey,
      now: request.now,
    });
    if (state.session.status === "completed") {
      updatedMockSession = await app.completeMockDraftSession({
        actorSessionToken: request.sessionToken,
        sessionId: updatedMockSession.id,
        expectedRevision: updatedMockSession.revision,
        now: request.now,
      });
    }

    return { status: 200, body: seasonMockResponseBody(updatedMockSession, state) };
  }

  return notFound();
};

const routeSeasonSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method === "GET" && request.segments.length === 1) {
    const seasonId = stringValue(request.query.seasonId);
    const runs = await app.listSimulationRuns({
      actorSessionToken: request.sessionToken,
      seasonId,
      historyLimit: 25,
      now: request.now,
    });
    return {
      status: 200,
      body: {
        history: runs
          .filter(run => run.request.seasonId === seasonId && run.result?.seasonSimulation !== undefined)
          .map(run => ({
            id: run.id,
            createdAt: run.createdAt,
            completedAt: run.completedAt,
            note: run.result?.note,
            strategyText: run.result?.strategyText,
            simulation: {
              draftFormat: run.result?.seasonSimulation?.draftFormat,
              runCount: run.result?.seasonSimulation?.runCount,
              completedCount: run.result?.seasonSimulation?.completedCount,
              strategy: run.result?.seasonSimulation?.strategy,
              targetOutcomes: run.result?.seasonSimulation?.targetOutcomes,
              targetOutcome: run.result?.seasonSimulation?.targetOutcome,
            },
          })),
      },
    };
  }
  if (request.method === "GET" && request.segments.length === 2) {
    const run = await app.getSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: request.segments[1] ?? "",
      now: request.now,
    });
    if (run.result?.seasonSimulation === undefined) return notFound();
    return {
      status: 200,
      body: {
        simulation: run.result.seasonSimulation,
        note: run.result.note,
        historyId: run.id,
      },
    };
  }
  if (request.segments.length !== 1 || request.method !== "POST") {
    return request.segments.length === 1 ? methodNotAllowed() : notFound();
  }
  const runCount = optionalNumber(request.body.count) ?? Number.NaN;
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > maximumSeasonSimulationRunCount) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      `Simulation run count must be a whole number from 1 through ${maximumSeasonSimulationRunCount}.`,
    );
  }
  const context = await seasonMockDraftContextFor(
    app,
    request,
    services,
    stringValue(request.body.seasonId),
  );
  if (!isSeasonMockDraftContext(context)) return context;
  const limited = actionRateLimitResponse(
    request,
    services.simulationRateLimiter,
    `${context.membership.userId}:season-simulation`,
    "Too many simulation runs. Try again later.",
  );
  if (limited !== null) return limited;
  const snapshots = context.season.settings.draftFormat === "auction"
    ? await app.listLeaguePricingSnapshots({
        actorSessionToken: request.sessionToken,
        leagueId: context.season.leagueId,
        seasonYear: context.season.seasonYear,
        scenarioId: "expected",
        now: request.now,
      })
    : [];
  const playerExpectedPrices = Object.fromEntries(
    (snapshots.at(-1)?.rows ?? []).map(row => [
      canonicalPlayerIdentityKey(row.playerName),
      row.marketPrice,
    ]),
  );
  const strategyPreset = parseLiveDraftStrategyKey(optionalString(request.body.strategyPreset) ?? "balanced");
  const presetStrategyInput: Readonly<Record<LiveDraftStrategyKey, string>> = {
    balanced: "",
    "three-rb": "prioritize 3 elite RBs",
    "hero-rb": "prioritize 1 elite RB and prioritize an elite WR",
    "wr-heavy": "prioritize 3 elite WRs",
  };
  const strategyInput = [
    presetStrategyInput[strategyPreset],
    optionalString(request.body.strategy) ?? "",
  ].filter(Boolean).join(" and ");
  const week1Projections = await loadLeagueScoredWeekOneProjections(
    context.season,
    context.setup.playerCatalog,
  );
  const seedPrefix = `season-simulation:${context.season.id}:${randomUUID()}`;
  const simulationInput = {
    season: context.season,
    setup: context.setup,
    humanTeamId: context.membership.teamId,
    runCount,
    strategyInput,
    seedPrefix,
    week1Projections,
    ...(context.season.settings.draftFormat === "auction" ? { playerExpectedPrices } : {}),
  };
  const simulation = services.seasonSimulationRunner === undefined
    ? runSeasonSimulations(simulationInput)
    : await services.seasonSimulationRunner(simulationInput, { signal: request.signal });

  const createdAt = request.now ?? new Date();
  const storedRun = await app.createSimulationRun({
    actorSessionToken: request.sessionToken,
    leagueId: context.season.leagueId,
    seasonId: context.season.id,
    ownerId: context.membership.ownerId,
    teamId: context.membership.teamId,
    count: runCount,
    seedPrefix,
    idempotencyKey: `season-simulation:${randomUUID()}`,
    strategy: {},
    now: createdAt,
  });
  const completedRun = await app.completeSeasonSimulationRun({
    actorSessionToken: request.sessionToken,
    runId: storedRun.id,
    result: {
      runId: storedRun.id,
      requestId: storedRun.request.id,
      completedAt: createdAt,
      runCount,
      seedPrefix,
      hardLockCount: 0,
      softTargetCount: 0,
      forcedSales: [],
      summary: { runCount, scenarios: [], players: [], owners: [], ownerPlayerExposure: [] },
      seasonSimulation: simulation,
      strategyText: strategyInput,
      ...(typeof request.body.note === "string" && request.body.note.trim().length > 0
        ? { note: request.body.note.trim().slice(0, 1_000) }
        : {}),
    },
    now: createdAt,
  });

  return { status: 200, body: { simulation, historyId: completedRun.id } };
};

const routePracticeShortlist = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  const seasonId = request.method === "GET"
    ? stringValue(request.query.seasonId)
    : optionalString(request.body.seasonId) ?? "";
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });

  if (request.method === "GET") {
    return {
      status: 200,
      body: { items: await app.listPracticeShortlist({
        actorSessionToken: request.sessionToken,
        seasonId: season.id,
        now: request.now,
      }) },
    };
  }

  const playerName = optionalString(request.body.playerName) ?? "";
  if (playerName.length === 0) {
    return knownError(400, "player_required", "Choose a player before changing your shortlist.");
  }
  if (request.method === "DELETE") {
    const removed = await app.removePracticeShortlistItem({
      actorSessionToken: request.sessionToken,
      seasonId: season.id,
      playerName,
      now: request.now,
    });
    return { status: 200, body: { removed } };
  }
  if (request.method !== "PUT") return methodNotAllowed();

  const setup = await seasonMockDraftSetupFor(season, request, services);
  if ("status" in setup) return setup;
  const player = setup.playerCatalog.find(candidate =>
    canonicalPlayerIdentityKey(candidate.name) === canonicalPlayerIdentityKey(playerName)
  );
  if (player === undefined) {
    return knownError(404, "player_not_found", "That player is not in this season's catalog.");
  }
  const maxBid = optionalNumber(request.body.maxBid);
  if (maxBid !== undefined && (!Number.isInteger(maxBid) || maxBid < 0)) {
    return knownError(400, "invalid_max_bid", "Maximum bid must be a non-negative whole dollar amount.");
  }
  const item = await app.savePracticeShortlistItem({
    actorSessionToken: request.sessionToken,
    seasonId: season.id,
    playerName: player.name,
    position: player.position,
    ...(maxBid === undefined ? {} : { maxBid }),
    now: request.now,
  });

  return { status: 200, body: { item } };
};

const liveDraftRoomReadModelForRequest = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  roomId: string,
) => await app.getLiveDraftRoomState({
  actorSessionToken: request.sessionToken,
  roomId,
  selectedTeamId: optionalString(request.query.selectedTeamId),
  viewedTeamId: optionalString(request.query.viewedTeamId),
  now: request.now,
});

const routeLiveRooms = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, roomId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();
    if (!hasProvisioningAccess(request, services)) return notFound();

    const room = await app.createLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      seasonId: stringValue(request.body.seasonId),
      roomId: stringValue(request.body.roomId),
      viewerPasswordHashRef: stringValue(request.body.viewerPasswordHashRef),
      startsAt: dateValue(request.body.startsAt),
      playerCatalog: arrayValue(request.body.playerCatalog) as readonly LiveDraftRoomPlayerCatalogEntry[],
      initialRosters: Array.isArray(request.body.initialRosters)
        ? request.body.initialRosters as readonly LiveDraftRoomInitialRosterPlayer[]
        : undefined,
      now: request.now,
    });

    return {
      status: 201,
      body: {
        room: await liveDraftRoomReadModelForRequest(app, request, room.roomId),
      },
    };
  }

  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const room = await liveDraftRoomReadModelForRequest(app, request, roomId ?? "");

    return { status: 200, body: { room } };
  }

  if (request.segments.length !== 3) return notFound();

  if (action === "my-team") {
    if (request.method !== "GET") return methodNotAllowed();
    if (services.postDraftProjectionProvider === undefined) {
      return knownError(503, "post_draft_analysis_unavailable", "My Team analysis is unavailable.");
    }
    const account = await requireRequestAccount(app, request);
    const room = await app.getLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      now: request.now,
    });
    const membership = (await app.listLeagueMemberships(room.leagueId))
      .find(candidate => candidate.userId === account.id);
    if (membership?.ownerId === undefined || membership.teamId === undefined) {
      throw new PlatformAppError("private_team_required", "Claim your team before opening My Team.");
    }
    const evaluatedAt = request.now ?? new Date();
    const projectionSnapshot = await services.postDraftProjectionProvider(
      room.season,
      room.playerCatalog,
      evaluatedAt,
    );
    const result = analyzeEndedLiveDraftRoomTeam({
      room,
      ownership: {
        userId: account.id,
        privateOwnerUserId: account.id,
        leagueId: room.leagueId,
        seasonId: room.seasonId,
        teamId: membership.teamId,
        ownerId: membership.ownerId,
      },
      projectionSnapshot,
      evaluatedAt,
      currentWeek: projectionSnapshot.metadata.week ?? 1,
    });

    return { status: 200, body: result };
  }

  if (action === "state") {
    if (request.method !== "GET") return methodNotAllowed();

    const state = await app.getLiveDraftRoomState({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      selectedTeamId: optionalString(request.query.selectedTeamId),
      viewedTeamId: optionalString(request.query.viewedTeamId),
      now: request.now,
    });

    return { status: 200, body: { state } };
  }

  if (action === "export") {
    if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed();

    const draftExport = await app.exportLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      exportedAt: requestDate(request.body, request.query, "exportedAt") ?? new Date(),
      now: request.now,
    });

    return { status: 200, body: { draftExport } };
  }

  if (action === "export-artifacts" || action === "export-artifact") {
    if (request.method !== "POST") return methodNotAllowed();

    const artifactResult = await app.createLiveDraftRoomExportArtifact({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      exportedAt: requestDate(request.body, request.query, "exportedAt") ?? new Date(),
      now: request.now,
    });

    return {
      status: 201,
      body: {
        artifact: artifactResult.artifact,
        content: artifactResult.content.toString("utf8"),
      },
    };
  }

  if (action === "events") {
    if (request.method !== "GET") return methodNotAllowed();

    const events = await app.getLiveDraftRoomEvents({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      afterRevision: optionalNumber(request.query.afterRevision) ?? 0,
      now: request.now,
    });

    return { status: 200, body: { events } };
  }

  if (action === "event-stream" || action === "events-stream") {
    if (request.method !== "GET") return methodNotAllowed();

    const events = await app.getLiveDraftRoomEvents({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      afterRevision: optionalNumber(request.query.afterRevision) ?? 0,
      now: request.now,
    });

    return {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
      body: formatLiveDraftRoomSsePayloads(events.events),
    };
  }

  if (request.method !== "POST") return methodNotAllowed();

  if (action === "start") {
    await app.startLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "pause") {
    await app.pauseLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "resume") {
    await app.resumeLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "sales" || action === "sale") {
    await app.logLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      sale: liveDraftSaleInputFor(request.body),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "undo") {
    await app.undoLastLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "corrections" || action === "correction") {
    await app.correctLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      saleEventId: stringValue(request.body.saleEventId),
      replacementSale: liveDraftSaleInputFor({ sale: request.body.replacementSale }),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  if (action === "end") {
    await app.endLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      allowIncomplete: optionalBoolean(request.body.allowIncomplete),
      now: request.now,
    });

    return { status: 200, body: { room: await liveDraftRoomReadModelForRequest(app, request, roomId ?? "") } };
  }

  return notFound();
};

const requireRequestAccount = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
) => {
  const account = await app.findAccountBySessionToken(request.sessionToken, request.now);
  if (account === null) {
    throw new PlatformAppError("auth_required", "Sign in before using this workspace.");
  }

  return account;
};

const requireSeasonManager = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  seasonId: string,
) => {
  const account = await requireRequestAccount(app, request);
  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId,
    now: request.now,
  });
  const membership = (await app.listLeagueMemberships(season.leagueId))
    .find(candidate => candidate.userId === account.id);
  if (membership?.role !== "owner" && membership?.role !== "admin") {
    throw new PlatformAppError(
      "shared_mutation_denied",
      "Only league owners and admins can manage league setup.",
    );
  }

  return account;
};

const routeOnboarding = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  repository: PlatformOnboardingRepository | undefined,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length !== 1) return notFound();
  if (request.method !== "GET") return methodNotAllowed();
  if (repository === undefined) {
    return knownError(503, "onboarding_unavailable", "League onboarding is not configured.");
  }

  const account = await requireRequestAccount(app, request);
  return {
    status: 200,
    body: await loadPlatformOnboarding(repository, { account }),
  };
};

const routeInvitations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const repository = services.invitationRepository;
  if (repository === undefined) {
    return knownError(503, "invitations_unavailable", "League invitations are not configured.");
  }
  const invitationTokenSecret = services.invitationTokenSecret
    ?? "mockd-local-development-invitation-secret";

  const [, invitationId, action] = request.segments;

  if (invitationId === "details" && request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();
    const token = stringValue(request.query.token);
    const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(token));
    const now = request.now ?? new Date();
    if (
      invitation === null ||
      invitation.status !== "pending" ||
      invitation.expiresAt < now
    ) {
      const isExpired = invitation !== null && invitation.expiresAt < now;
      throw new PlatformInvitationError(
        isExpired ? "invitation_expired" : "invitation_unavailable",
        isExpired
          ? "This invitation has expired. Ask the commissioner for a new link."
          : "This invitation is no longer available.",
      );
    }
    const leagueSetup = services.leagueSetupRepository;
    if (leagueSetup === undefined) {
      return knownError(503, "invitations_unavailable", "League invitations are not configured.");
    }
    const season = await leagueSetup.findLeagueSeason(invitation.seasonId);
    if (season === null) {
      throw new PlatformInvitationError(
        "invitation_unavailable",
        "This league season is no longer available.",
      );
    }
    const memberships = await leagueSetup.membershipsForLeague(season.leagueId);
    const claimedTeamIds = new Set(memberships.flatMap(membership =>
      membership.teamId === undefined ? [] : [membership.teamId]
    ));
    return {
      status: 200,
      body: {
        invitation: {
          id: invitation.id,
          seasonId: invitation.seasonId,
          kind: invitation.kind,
          ...(invitation.kind === "team" ? { teamId: invitation.teamId } : {}),
        },
        league: {
          id: season.leagueId,
          name: season.league.name,
          seasonYear: season.seasonYear,
        },
        teams: [...season.teams]
          .filter(team => invitation.kind === "league" || team.id === invitation.teamId)
          .sort((left, right) => left.draftOrderPosition - right.draftOrderPosition)
          .map(team => ({
            id: team.id,
            ownerId: team.ownerId,
            name: team.displayName,
            managerNames: team.managerDisplayNames,
            status: claimedTeamIds.has(team.id) ? "claimed" : "available",
          })),
      },
    };
  }

  if (invitationId === "claim" && request.segments.length === 2) {
    if (request.method !== "POST") return methodNotAllowed();
    const account = await requireRequestAccount(app, request);
    const token = stringValue(request.body.token);
    const teamId = stringValue(request.body.teamId);
    const invitation = await repository.findByTokenHash(hashPlatformInvitationToken(token));
    if (invitation === null) {
      throw new PlatformInvitationError(
        "invitation_not_found",
        "This invitation link is invalid. Ask the commissioner for a new link.",
      );
    }
    const now = request.now ?? new Date();
    if (invitation.status !== "pending") {
      throw new PlatformInvitationError(
        "invitation_unavailable",
        "This invitation is no longer available.",
      );
    }
    if (invitation.expiresAt < now) {
      throw new PlatformInvitationError(
        "invitation_expired",
        "This invitation has expired. Ask the commissioner for a new link.",
      );
    }
    const leagueSetup = services.leagueSetupRepository;
    if (leagueSetup === undefined) {
      return knownError(503, "invitations_unavailable", "League invitations are not configured.");
    }
    const season = await leagueSetup.findLeagueSeason(invitation.seasonId);
    const team = season?.teams.find(candidate => candidate.id === teamId);
    if (season === null || team === undefined) {
      throw new PlatformAppError("team_not_found", "Choose a team from this league season.");
    }
    const currentMembership = await leagueSetup.findMembership(account.id, season.leagueId);
    if (currentMembership?.teamId !== undefined) {
      if (currentMembership.teamId !== team.id) {
        return knownError(
          409,
          "team_already_selected",
          "Your account already has a team in this league.",
        );
      }
      return { status: 200, body: { membership: currentMembership } };
    }

    if (invitation.kind === "team") {
      if (invitation.teamId !== team.id) {
        throw new PlatformAppError("team_not_found", "Choose the team assigned by this invitation.");
      }
      const memberships = await app.listLeagueMemberships(invitation.leagueId);
      if (memberships.some(membership => membership.teamId === invitation.teamId)) {
        return knownError(
          409,
          "invitation_team_claimed",
          "The invited team is already claimed by a league member.",
        );
      }
      const accepted = await acceptPlatformInvitation(repository, {
        token,
        account,
        now,
      });
      await services.applyAcceptedMembership?.(accepted);
      return { status: 200, body: accepted };
    }

    const joined = await joinPlatformLeagueInvitation(repository, {
      token,
      account,
      now,
    });
    const membership = await app.joinInvitedLeagueSeasonTeam({
      actorSessionToken: request.sessionToken,
      seasonId: season.id,
      ownerId: team.ownerId,
      teamId: team.id,
      role: joined.membership.role,
      invitationTokenHash: hashPlatformInvitationToken(token),
      now: request.now,
    });
    return { status: 200, body: { invitation: joined.invitation, membership } };
  }

  if (request.segments.length === 1) {
    const seasonId = stringValue(request.query.seasonId);
    if (request.method === "GET") {
      await requireSeasonManager(app, request, seasonId);
      const season = await app.getLeagueSeason({
        actorSessionToken: request.sessionToken,
        seasonId,
        now: request.now,
      });
      const claimedTeamIds = (await app.listLeagueMemberships(season.leagueId))
        .flatMap(membership => membership.teamId === undefined ? [] : [membership.teamId]);
      return {
        status: 200,
        body: {
          invitations: await listPlatformInvitations(repository, seasonId, {
            leagueTokenSecret: invitationTokenSecret,
          }),
          claimedTeamIds,
        },
      };
    }
    if (request.method === "POST") {
      const submittedSeasonId = stringValue(request.body.seasonId);
      const account = await requireSeasonManager(app, request, submittedSeasonId);
      const season = await app.getLeagueSeason({
        actorSessionToken: request.sessionToken,
        seasonId: submittedSeasonId,
        now: request.now,
      });
      const invitationNow = request.now ?? new Date();
      const expiresAt = new Date(invitationNow.getTime() + 30 * 24 * 60 * 60 * 1_000);
      const hasTargetedInvitationFields =
        optionalString(request.body.teamId) !== undefined ||
        optionalString(request.body.email) !== undefined;
      if (!hasTargetedInvitationFields) {
        const pendingLeagueInvitation = (await repository.listForSeason(season.id)).find(candidate =>
          candidate.kind === "league" && candidate.status === "pending"
        );
        const invitation = pendingLeagueInvitation === undefined
          ? await issuePlatformLeagueInvitation(repository, {
              leagueId: season.leagueId,
              seasonId: season.id,
              invitedByUserId: account.id,
              now: invitationNow,
              expiresAt,
            }, {
              leagueTokenSecret: invitationTokenSecret,
            })
          : await reissuePlatformInvitation(repository, {
              invitationId: pendingLeagueInvitation.id,
              invitedByUserId: account.id,
              now: invitationNow,
              expiresAt,
            }, {
              leagueTokenSecret: invitationTokenSecret,
            });
        return {
          status: pendingLeagueInvitation === undefined ? 201 : 200,
          body: { invitation },
        };
      }
      const teamId = stringValue(request.body.teamId);
      const team = season.teams.find(candidate => candidate.id === teamId);
      if (team === undefined) {
        throw new PlatformAppError("team_not_found", "Choose a team from this league season.");
      }
      const email = normalizeEmail(stringValue(request.body.email));
      const memberships = await app.listLeagueMemberships(season.leagueId);
      if (memberships.some(membership => membership.teamId === team.id)) {
        return knownError(
          409,
          "invitation_team_claimed",
          "That team is already claimed by a league member.",
        );
      }
      const invitedAccount = await app.findAccountByEmail(email);
      if (
        invitedAccount !== null &&
        memberships.some(membership => membership.userId === invitedAccount.id)
      ) {
        return knownError(
          409,
          "invitation_existing_member",
          "That account is already an active member of this league.",
        );
      }
      const existingInvitations = await repository.listForSeason(season.id);
      const pendingForEmail = existingInvitations.find(candidate =>
        candidate.kind === "team" && candidate.status === "pending" && candidate.email === email
      );
      if (
        pendingForEmail !== undefined &&
        pendingForEmail.kind === "team" &&
        pendingForEmail.teamId !== team.id
      ) {
        return knownError(
          409,
          "invitation_email_conflict",
          "That email already has a pending invitation for another team.",
        );
      }
      const pendingForTeam = existingInvitations.find(candidate =>
        candidate.kind === "team" && candidate.status === "pending" && candidate.teamId === team.id
      );
      if (
        pendingForTeam !== undefined &&
        pendingForTeam.kind === "team" &&
        pendingForTeam.email !== email
      ) {
        return knownError(
          409,
          "invitation_team_conflict",
          "That team already has a pending invitation for another email.",
        );
      }
      const targetedExpiresAt = new Date(invitationNow.getTime() + 7 * 24 * 60 * 60 * 1_000);
      const invitation = pendingForEmail === undefined
        ? await issuePlatformInvitation(repository, {
            leagueId: season.leagueId,
            seasonId: season.id,
            email,
            role: "member",
            ownerId: team.ownerId,
            teamId: team.id,
            ownerDisplayName: team.ownerDisplayName,
            teamDisplayName: team.displayName,
            invitedByUserId: account.id,
            now: invitationNow,
            expiresAt: targetedExpiresAt,
          })
        : await reissuePlatformInvitation(repository, {
            invitationId: pendingForEmail.id,
            invitedByUserId: account.id,
            now: invitationNow,
            expiresAt: targetedExpiresAt,
          });

      return { status: pendingForEmail === undefined ? 201 : 200, body: { invitation } };
    }

    return methodNotAllowed();
  }

  if (invitationId === "accept" && request.segments.length === 2) {
    if (request.method !== "POST") return methodNotAllowed();
    const account = await requireRequestAccount(app, request);
    const token = stringValue(request.body.token);
    const pendingInvitation = await repository.findByTokenHash(hashPlatformInvitationToken(token));
    if (pendingInvitation?.kind === "team") {
      const memberships = await app.listLeagueMemberships(pendingInvitation.leagueId);
      if (memberships.some(membership => membership.userId === account.id)) {
        return knownError(
          409,
          "invitation_existing_member",
          "This account is already an active member of the league.",
        );
      }
      if (memberships.some(membership => membership.teamId === pendingInvitation.teamId)) {
        return knownError(
          409,
          "invitation_team_claimed",
          "The invited team is already claimed by a league member.",
        );
      }
    }
    const result = await acceptPlatformInvitation(repository, {
      token,
      account,
      now: request.now ?? new Date(),
    });
    await services.applyAcceptedMembership?.(result);
    return { status: 200, body: result };
  }

  if (request.segments.length !== 3 || (action !== "reissue" && action !== "revoke")) {
    return notFound();
  }
  if (request.method !== "POST") return methodNotAllowed();
  const invitation = await repository.findById(invitationId ?? "");
  if (invitation === null) {
    throw new PlatformInvitationError("invitation_not_found", "This invitation could not be found.");
  }
  const account = await requireSeasonManager(app, request, invitation.seasonId);
  if (action === "revoke") {
    return {
      status: 200,
      body: { invitation: await revokePlatformInvitation(repository, invitation.id, request.now ?? new Date()) },
    };
  }

  const issuedAt = request.now ?? new Date();
  return {
    status: 200,
    body: {
      invitation: await reissuePlatformInvitation(repository, {
        invitationId: invitation.id,
        invitedByUserId: account.id,
        now: issuedAt,
        expiresAt: new Date(issuedAt.getTime() + 7 * 24 * 60 * 60 * 1_000),
      }, {
        leagueTokenSecret: invitationTokenSecret,
      }),
    },
  };
};

export const createPlatformHttpHandler = (
  app: PlatformApp,
  services: PlatformHttpServices = {},
): PlatformHttpHandler =>
  async request => {
    try {
      const parsedRequest = parsedRequestFor(request);
      const [root] = parsedRequest.segments;
      const secureSessionCookie = secureSessionCookieFor(request);

      if (root === "healthz" && parsedRequest.segments.length === 1) {
        return parsedRequest.method === "GET" ? { status: 200, body: healthyResponseBody } : methodNotAllowed();
      }

      if (root === "readyz" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "GET") return methodNotAllowed();

        let ready = true;
        try {
          ready = await services.readinessProbe?.() ?? true;
        } catch {
          ready = false;
        }

        return ready
          ? { status: 200, body: healthyResponseBody }
          : { status: 503, body: unavailableResponseBody };
      }

      if (root === "accounts" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const denied = await accountCreationDenied(parsedRequest, services);
        if (denied !== null) return denied;
        const rateLimited = authRateLimitResponse(
          stringValue(parsedRequest.body.email),
          parsedRequest,
          services.accountRateLimiter,
          services.authClientRateLimiter,
        );
        if (rateLimited !== null) return rateLimited;

        const account = await app.createAccount({
          email: stringValue(parsedRequest.body.email),
          password: stringValue(parsedRequest.body.password),
          verificationReturnTo: optionalString(parsedRequest.body.returnTo),
          now: parsedRequest.now,
        });

        return services.emailVerificationRequired === true
          ? {
              status: 202,
              body: {
                accepted: true,
                message: "If this email can be registered, a verification link is on its way.",
              },
            }
          : { status: 201, body: { account } };
      }

      if (root === "email-verifications" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const rateLimited = authRateLimitResponse(
          stringValue(parsedRequest.body.email),
          parsedRequest,
          services.verificationRateLimiter,
          services.authClientRateLimiter,
        );
        if (rateLimited !== null) return rateLimited;
        await app.requestEmailVerification({
          email: stringValue(parsedRequest.body.email),
          verificationReturnTo: optionalString(parsedRequest.body.returnTo),
          now: parsedRequest.now,
        });
        return {
          status: 202,
          body: {
            accepted: true,
            message: "If this email is awaiting verification, a new link is on its way.",
          },
        };
      }

      if (root === "email-verifications" && parsedRequest.segments[1] === "consume") {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        await app.verifyEmail({ token: stringValue(parsedRequest.body.token), now: parsedRequest.now });
        return { status: 200, body: { verified: true } };
      }

      if (root === "password-resets" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const rateLimited = authRateLimitResponse(
          stringValue(parsedRequest.body.email),
          parsedRequest,
          services.passwordResetRateLimiter,
          services.authClientRateLimiter,
        );
        if (rateLimited !== null) return rateLimited;
        await app.requestPasswordReset({
          email: stringValue(parsedRequest.body.email),
          now: parsedRequest.now,
        });
        return {
          status: 202,
          body: {
            accepted: true,
            message: "If an account exists for this email, a password reset link is on its way.",
          },
        };
      }

      if (root === "password-resets" && parsedRequest.segments[1] === "consume") {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const limited = actionRateLimitResponse(
          parsedRequest,
          services.passwordResetConsumeRateLimiter,
          parsedRequest.clientAddress,
          "Too many password reset attempts. Try again later.",
        );
        if (limited !== null) return limited;
        await app.resetPasswordWithToken({
          token: stringValue(parsedRequest.body.token),
          newPassword: stringValue(parsedRequest.body.newPassword),
          newPasswordConfirmation: stringValue(parsedRequest.body.newPasswordConfirmation),
          now: parsedRequest.now,
        });
        return { status: 200, body: { reset: true } };
      }

      if (root === "sessions" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const rateLimited = authRateLimitResponse(
          stringValue(parsedRequest.body.email),
          parsedRequest,
          services.loginRateLimiter,
          services.authClientRateLimiter,
        );
        if (rateLimited !== null) return rateLimited;

        const login = await app.login({
          email: stringValue(parsedRequest.body.email),
          password: stringValue(parsedRequest.body.password),
          now: parsedRequest.now,
        });

        if (login === null) {
          return {
            status: 401,
            body: invalidCredentialsBody,
          };
        }

        services.loginRateLimiter?.reset(stringValue(parsedRequest.body.email));

        return {
          status: 200,
          headers: {
            "Set-Cookie": mockdSessionCookie(login.sessionToken, {
              expires: login.session.expiresAt,
              secure: secureSessionCookie,
            }),
          },
          body: {
            account: login.account,
            session: publicSessionFor(login.session),
          },
        };
      }

      if (
        root === "session" &&
        parsedRequest.segments.length === 2 &&
        parsedRequest.segments[1] === "password"
      ) {
        if (parsedRequest.method !== "PUT") return methodNotAllowed();
        const account = await requireRequestAccount(app, parsedRequest);
        const rateLimited = authRateLimitResponse(
          account.email,
          parsedRequest,
          services.loginRateLimiter,
          services.authClientRateLimiter,
        );
        if (rateLimited !== null) return rateLimited;

        await app.changePassword({
          actorSessionToken: parsedRequest.sessionToken,
          currentPassword: stringValue(parsedRequest.body.currentPassword),
          newPassword: stringValue(parsedRequest.body.newPassword),
          newPasswordConfirmation: stringValue(parsedRequest.body.newPasswordConfirmation),
          now: parsedRequest.now,
        });
        services.loginRateLimiter?.reset(account.email);

        return {
          status: 200,
          headers: {
            "Set-Cookie": clearMockdSessionCookie({ secure: secureSessionCookie }),
          },
          body: { ok: true },
        };
      }

      if (root === "session" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method === "GET") {
          const account = await app.findAccountBySessionToken(parsedRequest.sessionToken, parsedRequest.now);

          return account === null
            ? { status: 401, body: authRequiredBody }
            : { status: 200, body: { account } };
        }

        if (parsedRequest.method === "DELETE") {
          await app.logout({
            actorSessionToken: parsedRequest.sessionToken,
            now: parsedRequest.now,
          });

          return {
            status: 200,
            headers: {
              "Set-Cookie": clearMockdSessionCookie({ secure: secureSessionCookie }),
            },
            body: { ok: true },
          };
        }

        return methodNotAllowed();
      }

      if (root === "onboarding") {
        return await routeOnboarding(app, parsedRequest, services.onboardingRepository);
      }
      if (root === "player-catalog" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "GET") return methodNotAllowed();
        const account = await requireRequestAccount(app, parsedRequest);
        if (services.currentPlayerCatalogProvider === undefined) {
          return knownError(503, "player_catalog_unavailable", "The current player catalog is unavailable.");
        }
        const players = await services.currentPlayerCatalogProvider();
        const seasonId = optionalString(parsedRequest.query.seasonId);
        if (seasonId === undefined) return { status: 200, body: { players } };
        const season = await app.getLeagueSeason({
          actorSessionToken: parsedRequest.sessionToken,
          seasonId,
          now: parsedRequest.now,
        });
        const setup = await services.liveDraftRoomSetupRepository?.findForSeason(season.id) ?? null;
        const keepers = setup?.initialRosters.filter(player => player.source === "keeper") ?? [];
        const keeperByPlayer = new Map(keepers.map(keeper => [
          canonicalPlayerIdentityKey(keeper.playerName),
          keeper,
        ]));
        if (season.settings.draftFormat === "snake") {
          return {
            status: 200,
            body: {
              draftFormat: "snake",
              personalized: false,
              players: players.map((player, index) => {
                const keeper = keeperByPlayer.get(canonicalPlayerIdentityKey(player.name));
                return {
                  ...player,
                  marketRank: index + 1,
                  leagueRank: index + 1,
                  isKeeper: keeper !== undefined,
                  ...(keeper === undefined ? {} : {
                    keeperTeamId: keeper.teamId,
                    keeperRound: keeper.keeperRound,
                    keeperPrice: keeper.price,
                  }),
                };
              }),
            },
          };
        }
        const snapshots = await app.listLeaguePricingSnapshots({
          actorSessionToken: parsedRequest.sessionToken,
          leagueId: season.leagueId,
          seasonYear: season.seasonYear,
          scenarioId: "expected",
          now: parsedRequest.now,
        });
        const latest = snapshots.at(-1);
        const pricingByPlayer = new Map(
          (latest?.rows ?? []).map(row => [canonicalPlayerIdentityKey(row.playerName), row]),
        );
        const strategyKey = parseLiveDraftStrategyKey(optionalString(parsedRequest.query.strategy) ?? "balanced");
        const strategy = liveDraftStrategies[strategyKey];
        const membership = (await app.listLeagueMemberships(season.leagueId))
          .find(candidate => candidate.userId === account.id);
        const myKeepers = keepers.filter(keeper => keeper.teamId === membership?.teamId);
        const keeperPositionCounts = myKeepers.reduce<Record<string, number>>((counts, keeper) => {
          counts[keeper.position] = (counts[keeper.position] ?? 0) + 1;
          return counts;
        }, {});
        const flexTarget = ["RB", "WR", "TE"].reduce(
          (total, position) => total + Number(season.settings.roster.lineup[position] ?? 0),
          Number(season.settings.roster.lineup.FLEX ?? 0),
        );
        const currentFlexPlayers = ["RB", "WR", "TE"].reduce(
          (total, position) => total + (keeperPositionCounts[position] ?? 0),
          0,
        );
        const keeperSpend = myKeepers.reduce((total, keeper) => total + keeper.price, 0);
        const openRosterSlots = Math.max(0, season.settings.roster.rosterSize - myKeepers.length);
        const maximumBid = Math.max(
          0,
          season.settings.auction.budgetDollars
            - keeperSpend
            - Math.max(0, openRosterSlots - 1) * season.settings.auction.minimumBidDollars,
        );

        return {
          status: 200,
          body: {
            draftFormat: "auction",
            personalized: latest !== undefined,
            strategyKey,
            strategyLabel: strategy.label,
            ...(latest === undefined ? {} : { pricingModelRunId: latest.modelRunId }),
            players: players.map(player => {
              const pricing = pricingByPlayer.get(canonicalPlayerIdentityKey(player.name));
              const marketPrice = pricing?.marketPrice ?? player.expectedPrice;
              const keeper = keeperByPlayer.get(canonicalPlayerIdentityKey(player.name));
              const myValue = strategyAdjustedAuctionValue({
                marketValue: marketPrice,
                position: player.position,
                strategyKey,
                positionCount: keeperPositionCounts[player.position] ?? 0,
                starterCount: Number(season.settings.roster.lineup[player.position] ?? 0),
                flexNeedsPlayer: currentFlexPlayers < flexTarget,
                maximumBid,
              });

              return {
                ...player,
                marketPrice,
                myValue,
                leagueValue: myValue,
                recommendedMaxBid: Math.min(myValue, pricing?.recommendedMaxBid ?? myValue),
                isKeeper: keeper !== undefined,
                ...(keeper === undefined ? {} : {
                  keeperTeamId: keeper.teamId,
                  keeperPrice: keeper.price,
                }),
                pricingWarnings: pricing?.warnings ?? [],
              };
            }),
          },
        };
      }
      if (
        root === "league-imports" &&
        parsedRequest.segments.length === 3 &&
        parsedRequest.segments[1] === "espn" &&
        parsedRequest.segments[2] === "review"
      ) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const account = await requireRequestAccount(app, parsedRequest);
        if (services.espnLeagueSettingsImporter === undefined) {
          return knownError(503, "league_import_unavailable", "ESPN league import is unavailable.");
        }
        const season = optionalNumber(parsedRequest.body.season);
        if (season === undefined || !Number.isSafeInteger(season) || season <= 0) {
          return knownError(400, "invalid_season", "Choose a valid ESPN season.");
        }
        const limited = actionRateLimitResponse(
          parsedRequest,
          services.leagueImportRateLimiter,
          `${account.id}:espn-review`,
          "Too many ESPN league checks. Try again later.",
        );
        if (limited !== null) return limited;

        return {
          status: 200,
          body: await services.espnLeagueSettingsImporter({
            leagueIdOrUrl: stringValue(parsedRequest.body.leagueIdOrUrl),
            season,
          }),
        };
      }
      if (
        root === "league-imports" &&
        parsedRequest.segments.length === 3 &&
        parsedRequest.segments[1] === "espn" &&
        parsedRequest.segments[2] === "members-screenshot-review"
      ) {
        const account = await requireRequestAccount(app, parsedRequest);
        if (parsedRequest.method === "GET") {
          return {
            status: 200,
            body: { available: services.leagueMembersScreenshotAnalyzer !== undefined },
          };
        }
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const analyzer = services.leagueMembersScreenshotAnalyzer;
        if (analyzer === undefined) {
          return knownError(503, "screenshot_import_unavailable", "Screenshot import is not configured.");
        }
        const limited = screenshotRateLimitResponse(
          parsedRequest,
          services.screenshotImportRateLimiter,
          `${account.id}:league-create`,
        );
        if (limited !== null) return limited;

        return {
          status: 200,
          body: {
            import: await analyzer.analyze({
              mimeType: optionalString(parsedRequest.body.mimeType) ?? "",
              base64: optionalString(parsedRequest.body.base64) ?? "",
            }),
          },
        };
      }
      if (root === "leagues" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();
        const account = await requireRequestAccount(app, parsedRequest);
        const season = createLeagueSeasonFromConfirmedSetup(
          confirmedLeagueCreationInputFromUnknown(parsedRequest.body.setup),
        );
        const registeredSeason = await app.registerLeagueSeason({
          actorSessionToken: parsedRequest.sessionToken,
          season,
          memberships: [{
            userId: account.id,
            leagueId: season.leagueId,
            role: "owner",
          }],
          now: parsedRequest.now,
        });

        return { status: 201, body: { season: registeredSeason } };
      }
      if (root === "invitations") return await routeInvitations(app, parsedRequest, services);
      if (root === "seasons") return await routeSeason(app, parsedRequest, services);
      if (root === "simulations") return routeSimulations(app, parsedRequest, services);
      if (root === "historical-imports") return await routeHistoricalImports(app, parsedRequest, services);
      if (root === "pricing-snapshots") return await routePricingSnapshots(app, parsedRequest);
      if (root === "jobs") return await routeJobs(app, parsedRequest);
      if (root === "mock-sessions") return await routeMockSessions(app, parsedRequest);
      if (root === "season-mock-drafts") return await routeSeasonMockDrafts(app, parsedRequest, services);
      if (root === "season-simulations") return await routeSeasonSimulations(app, parsedRequest, services);
      if (root === "practice-shortlist") return await routePracticeShortlist(app, parsedRequest, services);
      if (root === "live-rooms") return await routeLiveRooms(app, parsedRequest, services);

      return notFound();
    } catch (error) {
      return errorResponseFor(error);
    }
  };
