import { createHash } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join, resolve } from "node:path";
import {
  createLiveDraftServer as createClassicLiveDraftServer,
  type CreateLiveDraftServerOptions,
  type LiveDraftServerApp,
} from "../liveDraftServer.js";

type MaybePromise<T> = T | Promise<T>;

export interface PlatformDraftToolsAccount {
  id: string;
}

export type PlatformDraftToolsAccountResolver = (
  request: IncomingMessage,
) => MaybePromise<PlatformDraftToolsAccount | null>;

export type PlatformDraftToolsSeasonAuthorizer = (
  account: PlatformDraftToolsAccount,
  seasonId: string,
  request: IncomingMessage,
) => MaybePromise<boolean>;

export type PlatformDraftToolsServerFactory = (
  options: CreateLiveDraftServerOptions,
) => Promise<LiveDraftServerApp>;

export interface CreatePlatformDraftToolsAdapterOptions {
  authorizeSeason: PlatformDraftToolsSeasonAuthorizer;
  baseSessionDirectory: string;
  resolveAccount: PlatformDraftToolsAccountResolver;
  createLiveDraftServer?: PlatformDraftToolsServerFactory | undefined;
  idleTimeoutMs?: number | undefined;
  maxRetainedApps?: number | undefined;
  now?: (() => number) | undefined;
}

export interface PlatformDraftToolsAdapter {
  (request: IncomingMessage, response: ServerResponse): Promise<boolean>;
  clearAccount(accountId: string): Promise<void>;
  close(): Promise<void>;
}

interface DraftToolsRoute {
  isApi: boolean;
  seasonId: string | null;
  targetUrl: string;
}

interface RetainedDraftToolsApp {
  accountId: string;
  activeRequests: number;
  appPromise: Promise<LiveDraftServerApp>;
  key: string;
  lastUsedAt: number;
}

const productPageMappings = new Map<string, { path: string; mode?: string }>([
  ["/board", { path: "/draft-room", mode: "real" }],
  ["/mock-drafts", { path: "/draft-room", mode: "interactive-mock" }],
  ["/mock-results", { path: "/mock-results" }],
  ["/simulations", { path: "/mock-simulations" }],
  ["/strategy", { path: "/draft-room", mode: "interactive-mock" }],
  ["/my-expert", { path: "/my-expert" }],
  ["/player-news", { path: "/player-news" }],
]);

const jsonContentType = "application/json; charset=utf-8";
const defaultIdleTimeoutMs = 30 * 60 * 1_000;
const defaultMaxRetainedApps = 32;
const validSeasonIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const securityHeaders = {
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
} as const;

const authRequiredBody = {
  error: {
    code: "auth_required",
    message: "Sign in to continue.",
  },
} as const;

const seasonRequiredBody = {
  error: {
    code: "season_required",
    message: "Choose a valid league season before opening draft tools.",
  },
} as const;

const membershipRequiredBody = {
  error: {
    code: "membership_required",
    message: "Join this league before opening its draft tools.",
  },
} as const;

const internalErrorBody = {
  error: {
    code: "internal_error",
    message: "Something went wrong.",
  },
} as const;

const writeJson = (response: ServerResponse, statusCode: number, body: unknown): void => {
  if (response.writableEnded) return;

  const encodedBody = JSON.stringify(body);
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-length": Buffer.byteLength(encodedBody),
    "content-type": jsonContentType,
  });
  response.end(encodedBody);
};

const redirectToLogin = (request: IncomingMessage, response: ServerResponse): void => {
  const returnTo = request.url?.startsWith("/") === true ? request.url : "/app";
  response.writeHead(302, {
    ...securityHeaders,
    "content-length": "0",
    location: `/login?returnTo=${encodeURIComponent(returnTo)}`,
  });
  response.end();
};

const mappedProductUrl = (source: URL, mapping: { path: string; mode?: string }): string => {
  if (mapping.mode === undefined) return `${mapping.path}${source.search}`;

  const target = new URL(mapping.path, "http://mockd.local");
  target.searchParams.set("mode", mapping.mode);
  for (const [name, value] of source.searchParams) {
    if (name !== "mode") target.searchParams.append(name, value);
  }

  return `${target.pathname}${target.search}`;
};

const routeFor = (request: IncomingMessage): DraftToolsRoute | undefined => {
  let url: URL;
  try {
    url = new URL(request.url ?? "/", "http://mockd.local");
  } catch {
    return undefined;
  }

  const requestedSeasonIds = url.searchParams.getAll("seasonId");
  const seasonId = requestedSeasonIds.length === 1 &&
      validSeasonIdPattern.test(requestedSeasonIds[0] ?? "")
    ? requestedSeasonIds[0] ?? null
    : null;

  if (url.pathname.startsWith("/api/")) {
    return { isApi: true, seasonId, targetUrl: `${url.pathname}${url.search}` };
  }

  if (request.method !== "GET") return undefined;
  const mapping = productPageMappings.get(url.pathname);
  if (mapping === undefined) return undefined;

  return {
    isApi: false,
    seasonId,
    targetUrl: mappedProductUrl(url, mapping),
  };
};

const scopedSessionDirectory = (
  baseDirectory: string,
  accountId: string,
  seasonId: string,
): string => {
  const accountDirectoryKey = createHash("sha256").update(accountId).digest("hex");
  const seasonDirectoryKey = createHash("sha256").update(seasonId).digest("hex");
  return join(
    baseDirectory,
    `account-${accountDirectoryKey}`,
    `season-${seasonDirectoryKey}`,
  );
};

const scopeKeyFor = (accountId: string, seasonId: string): string =>
  `${accountId}\0${seasonId}`;

const positiveIntegerOption = (value: number | undefined, fallback: number, name: string): number => {
  const resolvedValue = value ?? fallback;
  if (!Number.isSafeInteger(resolvedValue) || resolvedValue <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return resolvedValue;
};

const disposeApp = async (app: LiveDraftServerApp): Promise<void> => {
  app.server.removeAllListeners("request");
  app.server.closeAllConnections();
  app.server.closeIdleConnections();
  if (!app.server.listening) return;

  await new Promise<void>((resolveClose, rejectClose) => {
    app.server.close(error => {
      if (error === undefined) resolveClose();
      else rejectClose(error);
    });
  });
};

const delegateRequest = (
  app: LiveDraftServerApp,
  request: IncomingMessage,
  response: ServerResponse,
  targetUrl: string,
): void => {
  const originalUrl = request.url;
  let restored = false;
  const restoreRequestUrl = (): void => {
    if (restored) return;
    restored = true;
    request.url = originalUrl;
    response.off("finish", restoreRequestUrl);
    response.off("close", restoreRequestUrl);
  };

  request.url = targetUrl;
  for (const [name, value] of Object.entries(securityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
  response.once("finish", restoreRequestUrl);
  response.once("close", restoreRequestUrl);

  try {
    if (!app.server.emit("request", request, response)) {
      throw new Error("Classic draft server has no request handler.");
    }
  } catch (error) {
    restoreRequestUrl();
    throw error;
  }
};

export const createPlatformDraftToolsAdapter = (
  options: CreatePlatformDraftToolsAdapterOptions,
): PlatformDraftToolsAdapter => {
  const baseSessionDirectory = resolve(options.baseSessionDirectory);
  const createLiveDraftServer = options.createLiveDraftServer ?? createClassicLiveDraftServer;
  const idleTimeoutMs = positiveIntegerOption(
    options.idleTimeoutMs,
    defaultIdleTimeoutMs,
    "idleTimeoutMs",
  );
  const maxRetainedApps = positiveIntegerOption(
    options.maxRetainedApps,
    defaultMaxRetainedApps,
    "maxRetainedApps",
  );
  const now = options.now ?? Date.now;
  const appsByScope = new Map<string, RetainedDraftToolsApp>();
  let closed = false;

  const disposeEntry = async (entry: RetainedDraftToolsApp): Promise<void> => {
    if (appsByScope.get(entry.key) === entry) appsByScope.delete(entry.key);
    try {
      await disposeApp(await entry.appPromise);
    } catch {
      // A failed initialization has no reusable server state to retain.
    }
  };

  const pruneEntries = async (currentTime: number, targetSize: number): Promise<void> => {
    const idleEntries = [...appsByScope.values()]
      .filter(entry => entry.activeRequests === 0)
      .sort((left, right) => left.lastUsedAt - right.lastUsedAt);
    const expiredEntries = idleEntries.filter(
      entry => currentTime - entry.lastUsedAt >= idleTimeoutMs,
    );

    for (const entry of expiredEntries) await disposeEntry(entry);

    for (const entry of idleEntries) {
      if (appsByScope.size <= targetSize) break;
      if (appsByScope.has(entry.key)) await disposeEntry(entry);
    }
  };

  const createEntry = (
    accountId: string,
    seasonId: string,
    currentTime: number,
  ): RetainedDraftToolsApp => {
    const key = scopeKeyFor(accountId, seasonId);
    let entry: RetainedDraftToolsApp;
    const appPromise = Promise.resolve().then(async () => {
      const app = await createLiveDraftServer({
        sessionDirectory: scopedSessionDirectory(baseSessionDirectory, accountId, seasonId),
      });
      if (app.server.listening) {
        await disposeApp(app);
        throw new Error("Classic draft server must be unbound.");
      }
      return app;
    });
    entry = {
      accountId,
      activeRequests: 1,
      appPromise,
      key,
      lastUsedAt: currentTime,
    };
    appsByScope.set(key, entry);
    void appPromise.catch(() => {
      if (appsByScope.get(key) === entry) appsByScope.delete(key);
    });
    return entry;
  };

  const acquireEntry = async (
    accountId: string,
    seasonId: string,
  ): Promise<{ app: LiveDraftServerApp; entry: RetainedDraftToolsApp }> => {
    const key = scopeKeyFor(accountId, seasonId);
    const currentTime = now();
    let entry = appsByScope.get(key);

    if (entry === undefined) {
      await pruneEntries(currentTime, maxRetainedApps - 1);
      if (closed) throw new Error("Draft tools adapter is unavailable.");

      entry = appsByScope.get(key);
      if (entry === undefined) {
        if (appsByScope.size >= maxRetainedApps) {
          throw new Error("Draft tools adapter is at capacity.");
        }
        entry = createEntry(accountId, seasonId, currentTime);
      } else {
        entry.activeRequests += 1;
        entry.lastUsedAt = currentTime;
      }
    } else {
      entry.activeRequests += 1;
      entry.lastUsedAt = currentTime;
    }

    try {
      return { app: await entry.appPromise, entry };
    } catch (error) {
      entry.activeRequests -= 1;
      throw error;
    }
  };

  const releaseEntry = (entry: RetainedDraftToolsApp): void => {
    entry.activeRequests = Math.max(0, entry.activeRequests - 1);
    entry.lastUsedAt = now();
    void pruneEntries(entry.lastUsedAt, maxRetainedApps).catch(() => {
      // Request cleanup is best-effort; a later request or close retries it.
    });
  };

  const clearAccount = async (accountId: string): Promise<void> => {
    const entries = [...appsByScope.values()].filter(entry => entry.accountId === accountId);
    await Promise.all(entries.map(disposeEntry));
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    const entries = [...appsByScope.values()];
    appsByScope.clear();
    await Promise.all(entries.map(disposeEntry));
  };

  const handle = async (request: IncomingMessage, response: ServerResponse): Promise<boolean> => {
    const route = routeFor(request);
    if (route === undefined) return false;

    try {
      const account = await options.resolveAccount(request);
      if (account === null) {
        if (route.isApi) writeJson(response, 401, authRequiredBody);
        else redirectToLogin(request, response);
        return true;
      }
      if (account.id.trim().length === 0 || closed) throw new Error("Draft tools adapter is unavailable.");
      if (route.seasonId === null) {
        writeJson(response, 400, seasonRequiredBody);
        return true;
      }
      if (!await options.authorizeSeason(account, route.seasonId, request)) {
        writeJson(response, 403, membershipRequiredBody);
        return true;
      }

      const { app, entry } = await acquireEntry(account.id, route.seasonId);
      let released = false;
      const release = (): void => {
        if (released) return;
        released = true;
        response.off("finish", release);
        response.off("close", release);
        releaseEntry(entry);
      };
      response.once("finish", release);
      response.once("close", release);
      try {
        delegateRequest(app, request, response, route.targetUrl);
      } catch (error) {
        release();
        throw error;
      }
    } catch {
      if (response.headersSent) response.destroy();
      else writeJson(response, 500, internalErrorBody);
    }

    return true;
  };

  return Object.assign(handle, { clearAccount, close });
};
