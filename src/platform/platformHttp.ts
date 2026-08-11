import { timingSafeEqual } from "node:crypto";
import { AuthError, normalizeEmail } from "./auth.js";
import type {
  ClientAddressRateLimiter,
  NormalizedEmailRateLimiter,
} from "./authRateLimit.js";
import type { SessionRecord } from "./auth.js";
import { DraftExportError } from "./draftExport.js";
import { ExportArtifactError } from "./exportArtifacts.js";
import { JobError } from "./jobs.js";
import type { LeagueSeason } from "./leagueSeason.js";
import { LeagueSetupWriteConflictError } from "./leagueSetup.js";
import {
  LiveDraftRoomError,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
import { formatLiveDraftRoomSsePayloads } from "./liveDraftRoomStream.js";
import {
  MockDraftSessionError,
  type MockDraftModeMetadata,
  type MockDraftResultReference,
} from "./mockSessions.js";
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
import { HistoricalImportError } from "./historicalImports.js";
import {
  PricingSnapshotError,
  type PricingSourcePrice,
} from "./pricingSnapshots.js";
import {
  clearMockdSessionCookie,
  mockdSessionCookie,
} from "./platformCookies.js";
import {
  acceptPlatformInvitation,
  issuePlatformInvitation,
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
  invitationRepository?: PlatformInvitationRepository | undefined;
  applyAcceptedMembership?: ((result: AcceptedPlatformInvitation) => void | Promise<void>) | undefined;
  readinessProbe?: (() => boolean | Promise<boolean>) | undefined;
  liveDraftRoomSetupProvider?: ((season: LeagueSeason) => Promise<{
    playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[];
    initialRosters: readonly LiveDraftRoomInitialRosterPlayer[];
  } | null>) | undefined;
  provisioningToken?: string | undefined;
  allowPublicSignup?: boolean | undefined;
  accountRateLimiter?: NormalizedEmailRateLimiter | undefined;
  loginRateLimiter?: NormalizedEmailRateLimiter | undefined;
  authClientRateLimiter?: ClientAddressRateLimiter | undefined;
  leagueMembersScreenshotAnalyzer?: LeagueMembersScreenshotAnalyzer | undefined;
  screenshotImportRateLimiter?: ClientAddressRateLimiter | undefined;
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
    invitation.email !== email
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
      : error.code === "invalid_current_password"
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

const routeSeasonHistoricalImports = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (action !== "preview") return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  const season = await app.getLeagueSeason({
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    now: request.now,
  });
  const sourceText = optionalString(request.body.sourceText)
    ?? optionalString(request.body.content)
    ?? "";
  const result = await app.previewHistoricalImportSource({
    actorSessionToken: request.sessionToken,
    leagueId: season.leagueId,
    seasonYear: season.seasonYear,
    sourceText,
    replacementRequested: optionalBoolean(request.body.replacementRequested),
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
    return await routeSeasonHistoricalImports(app, request);
  }

  if (seasonAction === "pricing" || seasonAction === "pricing-snapshots") {
    return await routeSeasonPricing(app, request);
  }

  if (seasonAction === "live-room" && request.segments.length === 3) {
    if (request.method !== "POST") return methodNotAllowed();

    await requireSeasonManager(app, request, seasonId ?? "");
    const season = await app.getLeagueSeason({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      now: request.now,
    });
    const startsAt = dateValue(request.body.startsAt);
    if (request.body.startsAt !== undefined && startsAt === undefined) {
      return knownError(400, "invalid_draft_time", "Choose a valid draft date and time.");
    }
    const setup = await services.liveDraftRoomSetupProvider?.(season) ?? null;
    if (setup === null) {
      return knownError(
        409,
        "live_draft_setup_missing",
        "Publish this season's player catalog and keepers before creating its live room.",
      );
    }
    const room = await app.createLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      seasonId: season.id,
      roomId: `room-${season.id}-real`,
      viewerPasswordHashRef: `account-membership:${season.id}`,
      ...(startsAt === undefined ? {} : { startsAt }),
      playerCatalog: setup.playerCatalog,
      initialRosters: setup.initialRosters,
      now: request.now,
    });

    return { status: 201, body: { room } };
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

    return { status: 200, body: { season } };
  }

  if (request.method === "PUT") {
    return await registerSeason(app, request, seasonId);
  }

  return methodNotAllowed();
};

const routeSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
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
): Promise<PlatformHttpResponse> => {
  const [, batchId, action] = request.segments;
  if (request.segments.length !== 3 || action !== "commit") return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  const result = await app.commitHistoricalImport({
    actorSessionToken: request.sessionToken,
    batchId: batchId ?? "",
    now: request.now,
  });

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

    return { status: 201, body: { room } };
  }

  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const room = await app.getLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (request.segments.length !== 3) return notFound();

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
    const room = await app.startLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "pause") {
    const room = await app.pauseLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "resume") {
    const room = await app.resumeLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "sales" || action === "sale") {
    const room = await app.logLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      sale: liveDraftSaleInputFor(request.body),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "undo") {
    const room = await app.undoLastLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "corrections" || action === "correction") {
    const room = await app.correctLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      saleEventId: stringValue(request.body.saleEventId),
      replacementSale: liveDraftSaleInputFor({ sale: request.body.replacementSale }),
      now: request.now,
    });

    return { status: 200, body: { room } };
  }

  if (action === "end") {
    const room = await app.endLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      allowIncomplete: optionalBoolean(request.body.allowIncomplete),
      now: request.now,
    });

    return { status: 200, body: { room } };
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

  const [, invitationId, action] = request.segments;
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
          invitations: await listPlatformInvitations(repository, seasonId),
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
        candidate.status === "pending" && candidate.email === email
      );
      if (pendingForEmail !== undefined && pendingForEmail.teamId !== team.id) {
        return knownError(
          409,
          "invitation_email_conflict",
          "That email already has a pending invitation for another team.",
        );
      }
      const pendingForTeam = existingInvitations.find(candidate =>
        candidate.status === "pending" && candidate.teamId === team.id
      );
      if (pendingForTeam !== undefined && pendingForTeam.email !== email) {
        return knownError(
          409,
          "invitation_team_conflict",
          "That team already has a pending invitation for another email.",
        );
      }
      const invitationNow = request.now ?? new Date();
      const expiresAt = new Date(invitationNow.getTime() + 7 * 24 * 60 * 60 * 1_000);
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
            expiresAt,
          })
        : await reissuePlatformInvitation(repository, {
            invitationId: pendingForEmail.id,
            invitedByUserId: account.id,
            now: invitationNow,
            expiresAt,
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
    if (pendingInvitation !== null) {
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
          now: parsedRequest.now,
        });

        return { status: 201, body: { account } };
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
            sessionToken: login.sessionToken,
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
      if (root === "invitations") return await routeInvitations(app, parsedRequest, services);
      if (root === "seasons") return await routeSeason(app, parsedRequest, services);
      if (root === "simulations") return routeSimulations(app, parsedRequest);
      if (root === "historical-imports") return await routeHistoricalImports(app, parsedRequest);
      if (root === "pricing-snapshots") return await routePricingSnapshots(app, parsedRequest);
      if (root === "jobs") return await routeJobs(app, parsedRequest);
      if (root === "mock-sessions") return await routeMockSessions(app, parsedRequest);
      if (root === "live-rooms") return await routeLiveRooms(app, parsedRequest, services);

      return notFound();
    } catch (error) {
      return errorResponseFor(error);
    }
  };
