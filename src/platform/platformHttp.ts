import { AuthError } from "./auth.js";
import type { SessionRecord } from "./auth.js";
import { DraftExportError } from "./draftExport.js";
import type { LeagueSeason } from "./leagueSeason.js";
import {
  LiveDraftRoomError,
  type LiveDraftRoomInitialRosterPlayer,
  type LiveDraftRoomPlayerCatalogEntry,
  type LiveDraftRoomSaleCommandInput,
} from "./liveDraftRooms.js";
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
  applyLeagueSetupImport,
  previewLeagueSetupImport,
  type PlatformLeagueSetupImportInput,
  type PlatformLeagueSetupImportKnownUser,
} from "./platformSetupHttp.js";
import {
  SimulationError,
  type SimulationStrategyInput,
} from "./simulations.js";

export interface PlatformHttpRequest {
  method: string;
  path: string;
  body?: unknown;
  query?: Record<string, unknown> | undefined;
  sessionToken?: string | undefined;
  headers?: Record<string, string | undefined> | undefined;
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
}

export type PlatformApp = ReturnType<typeof createPlatformApp>;

export type PlatformHttpHandler = (request: PlatformHttpRequest) => Promise<PlatformHttpResponse>;

interface ParsedPlatformHttpRequest {
  method: string;
  segments: readonly string[];
  body: Record<string, unknown>;
  query: Record<string, unknown>;
  sessionToken: string;
}

type PublicSessionRecord = Omit<SessionRecord, "tokenHash">;

const invalidCredentialsBody: PlatformHttpErrorBody = {
  error: {
    code: "invalid_credentials",
    message: "Email or password is incorrect.",
  },
};

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
    sessionToken: sessionTokenFor(request),
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
    case "league_not_found":
    case "season_not_found":
    case "team_not_found":
      return 404;
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
    case "idempotency_conflict":
    case "max_bid_exceeded":
    case "no_sale_to_undo":
    case "position_limit":
    case "room_already_ended":
    case "room_already_exists":
    case "room_already_live":
    case "room_not_live":
    case "roster_full":
    case "season_not_ready":
    case "stale_revision":
      return 409;
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

const errorResponseFor = (error: unknown): PlatformHttpResponse<PlatformHttpErrorBody> => {
  if (error instanceof URIError) {
    return knownError(400, "invalid_request", "Request path is invalid.");
  }

  if (error instanceof AuthError) {
    return knownError(error.code === "duplicate_email" ? 409 : 400, error.code, error.message);
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

const registerSeason = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  expectedSeasonId?: string | undefined,
): PlatformHttpResponse => {
  const seasonInput = unknownRecord(request.body.season);
  if (expectedSeasonId !== undefined && optionalString(seasonInput?.id) !== expectedSeasonId) {
    return knownError(
      400,
      "season_id_mismatch",
      "Season body must match the route season id.",
    );
  }

  const season = app.registerLeagueSeason({
    actorSessionToken: request.sessionToken,
    season: request.body.season as LeagueSeason,
    memberships: arrayValue(request.body.memberships) as readonly PlatformLeagueMembership[],
    now: requestDate(request.body, request.query, "now"),
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

const routeSeasonSetupImport = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse => {
  const [, seasonId, , action] = request.segments;
  if (request.segments.length !== 4) return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  const content = optionalString(request.body.content);
  const now = requestDate(request.body, request.query, "now");
  const input: PlatformLeagueSetupImportInput = {
    actorSessionToken: request.sessionToken,
    seasonId: seasonId ?? "",
    rows: stringArrayValue(request.body.rows),
    knownUsers: setupImportKnownUsers(request.body.knownUsers),
    ...(content === undefined ? {} : { content }),
    ...(now === undefined ? {} : { now }),
  };

  if (action === "preview") return previewLeagueSetupImport(app, input);
  if (action === "apply") return applyLeagueSetupImport(app, input);

  return notFound();
};

const routeSeason = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse => {
  const [seasonRoot, seasonId, seasonAction] = request.segments;
  if (seasonRoot !== "seasons") return notFound();

  if (request.segments.length === 1 && request.method === "POST") {
    return registerSeason(app, request);
  }

  if (seasonAction === "setup-import") {
    return routeSeasonSetupImport(app, request);
  }

  if (request.segments.length !== 2) return notFound();

  if (request.method === "GET") {
    const season = app.getLeagueSeason({
      actorSessionToken: request.sessionToken,
      seasonId: seasonId ?? "",
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { season } };
  }

  if (request.method === "PUT") {
    return registerSeason(app, request, seasonId);
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
      const simulations = app.listSimulationRuns({
        actorSessionToken: request.sessionToken,
        now: requestDate(request.body, request.query, "now"),
      });

      return { status: 200, body: { simulations } };
    }

    if (request.method === "POST") {
      const simulation = app.createSimulationRun({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        count: optionalNumber(request.body.count) ?? Number.NaN,
        seedPrefix: stringValue(request.body.seedPrefix),
        idempotencyKey: stringValue(request.body.idempotencyKey),
        strategy: (request.body.strategy ?? {}) as SimulationStrategyInput,
        now: requestDate(request.body, request.query, "now"),
      });

      return { status: 201, body: { simulation } };
    }

    return methodNotAllowed();
  }

  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const simulation = app.getSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { simulation } };
  }

  if (request.segments.length === 3 && action === "execute") {
    if (request.method !== "POST") return methodNotAllowed();

    const simulation = await app.executeSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { simulation } };
  }

  return notFound();
};

const routeMockSessions = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse => {
  const [, sessionId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method === "GET") {
      const mockSessions = app.listMockDraftSessions({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.query.leagueId),
        seasonId: stringValue(request.query.seasonId),
        ownerId: stringValue(request.query.ownerId),
        teamId: optionalString(request.query.teamId),
        now: requestDate(request.body, request.query, "now"),
      });

      return { status: 200, body: { mockSessions } };
    }

    if (request.method === "POST") {
      const status = request.body.status === "setup" || request.body.status === "active"
        ? request.body.status
        : undefined;
      const mockSession = app.createMockDraftSession({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        draftMode: request.body.draftMode as MockDraftModeMetadata,
        status,
        now: requestDate(request.body, request.query, "now"),
      });

      return { status: 201, body: { mockSession } };
    }

    return methodNotAllowed();
  }

  if (request.segments.length !== 3) return notFound();
  if (request.method !== "POST") return methodNotAllowed();

  if (action === "commands" || action === "append") {
    const mockSession = app.appendMockDraftCommand({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      expectedCommandCount: optionalNumber(request.body.expectedCommandCount) ?? Number.NaN,
      commandId: stringValue(request.body.commandId),
      command: stringValue(request.body.command),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      latestResultRef: request.body.latestResultRef as MockDraftResultReference | undefined,
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { mockSession } };
  }

  if (action === "reset") {
    const mockSession = app.resetMockDraftSession({
      actorSessionToken: request.sessionToken,
      sessionId: sessionId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision) ?? Number.NaN,
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { mockSession } };
  }

  return notFound();
};

const routeLiveRooms = (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): PlatformHttpResponse => {
  const [, roomId, action] = request.segments;

  if (request.segments.length === 1) {
    if (request.method !== "POST") return methodNotAllowed();

    const room = app.createLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      seasonId: stringValue(request.body.seasonId),
      roomId: stringValue(request.body.roomId),
      viewerPasswordHashRef: stringValue(request.body.viewerPasswordHashRef),
      startsAt: dateValue(request.body.startsAt),
      playerCatalog: arrayValue(request.body.playerCatalog) as readonly LiveDraftRoomPlayerCatalogEntry[],
      initialRosters: Array.isArray(request.body.initialRosters)
        ? request.body.initialRosters as readonly LiveDraftRoomInitialRosterPlayer[]
        : undefined,
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 201, body: { room } };
  }

  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();

    const room = app.getLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { room } };
  }

  if (request.segments.length !== 3) return notFound();

  if (action === "export") {
    if (request.method !== "GET" && request.method !== "POST") return methodNotAllowed();

    const draftExport = app.exportLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      exportedAt: requestDate(request.body, request.query, "exportedAt") ?? new Date(),
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { draftExport } };
  }

  if (request.method !== "POST") return methodNotAllowed();

  if (action === "start") {
    const room = app.startLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { room } };
  }

  if (action === "sales" || action === "sale") {
    const room = app.logLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      sale: request.body.sale as LiveDraftRoomSaleCommandInput,
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { room } };
  }

  if (action === "undo") {
    const room = app.undoLastLiveDraftSale({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { room } };
  }

  if (action === "end") {
    const room = app.endLiveDraftRoom({
      actorSessionToken: request.sessionToken,
      roomId: roomId ?? "",
      expectedRevision: optionalNumber(request.body.expectedRevision),
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: requestDate(request.body, request.query, "now"),
    });

    return { status: 200, body: { room } };
  }

  return notFound();
};

export const createPlatformHttpHandler = (app: PlatformApp): PlatformHttpHandler =>
  async request => {
    try {
      const parsedRequest = parsedRequestFor(request);
      const [root] = parsedRequest.segments;

      if (root === "accounts" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();

        const account = app.createAccount({
          email: stringValue(parsedRequest.body.email),
          password: stringValue(parsedRequest.body.password),
          now: requestDate(parsedRequest.body, parsedRequest.query, "now"),
        });

        return { status: 201, body: { account } };
      }

      if (root === "sessions" && parsedRequest.segments.length === 1) {
        if (parsedRequest.method !== "POST") return methodNotAllowed();

        const login = app.login({
          email: stringValue(parsedRequest.body.email),
          password: stringValue(parsedRequest.body.password),
          now: requestDate(parsedRequest.body, parsedRequest.query, "now"),
        });

        if (login === null) {
          return {
            status: 401,
            body: invalidCredentialsBody,
          };
        }

        return {
          status: 200,
          body: {
            account: login.account,
            session: publicSessionFor(login.session),
            sessionToken: login.sessionToken,
          },
        };
      }

      if (root === "seasons") return routeSeason(app, parsedRequest);
      if (root === "simulations") return routeSimulations(app, parsedRequest);
      if (root === "mock-sessions") return routeMockSessions(app, parsedRequest);
      if (root === "live-rooms") return routeLiveRooms(app, parsedRequest);

      return notFound();
    } catch (error) {
      return errorResponseFor(error);
    }
  };
