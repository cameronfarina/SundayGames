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

export type PlatformDraftToolsServerFactory = (
  options: CreateLiveDraftServerOptions,
) => Promise<LiveDraftServerApp>;

export interface CreatePlatformDraftToolsAdapterOptions {
  baseSessionDirectory: string;
  resolveAccount: PlatformDraftToolsAccountResolver;
  createLiveDraftServer?: PlatformDraftToolsServerFactory | undefined;
}

export interface PlatformDraftToolsAdapter {
  (request: IncomingMessage, response: ServerResponse): Promise<boolean>;
  clearAccount(accountId: string): Promise<void>;
  close(): Promise<void>;
}

interface DraftToolsRoute {
  isApi: boolean;
  targetUrl: string;
}

const productPageMappings = new Map<string, { path: string; mode?: string }>([
  ["/board", { path: "/draft-room", mode: "real" }],
  ["/mock-drafts", { path: "/draft-room", mode: "interactive-mock" }],
  ["/mock-results", { path: "/mock-results" }],
  ["/simulations", { path: "/mock-simulations" }],
  ["/my-expert", { path: "/my-expert" }],
  ["/player-news", { path: "/player-news" }],
]);

const jsonContentType = "application/json; charset=utf-8";
const securityHeaders = {
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
} as const;

const authRequiredBody = {
  error: {
    code: "auth_required",
    message: "Sign in to continue.",
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

  if (url.pathname.startsWith("/api/")) {
    return { isApi: true, targetUrl: `${url.pathname}${url.search}` };
  }

  if (request.method !== "GET") return undefined;
  const mapping = productPageMappings.get(url.pathname);
  if (mapping === undefined) return undefined;

  return {
    isApi: false,
    targetUrl: mappedProductUrl(url, mapping),
  };
};

const accountSessionDirectory = (baseDirectory: string, accountId: string): string => {
  const accountDirectoryKey = createHash("sha256").update(accountId).digest("hex");
  return join(baseDirectory, `account-${accountDirectoryKey}`);
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
  const appsByAccountId = new Map<string, Promise<LiveDraftServerApp>>();
  let closed = false;

  const appForAccount = (accountId: string): Promise<LiveDraftServerApp> => {
    const existing = appsByAccountId.get(accountId);
    if (existing !== undefined) return existing;

    const created = Promise.resolve()
      .then(async () => {
        const app = await createLiveDraftServer({
          sessionDirectory: accountSessionDirectory(baseSessionDirectory, accountId),
        });
        if (app.server.listening) {
          await disposeApp(app);
          throw new Error("Classic draft server must be unbound.");
        }
        return app;
      });
    appsByAccountId.set(accountId, created);
    void created.catch(() => {
      if (appsByAccountId.get(accountId) === created) appsByAccountId.delete(accountId);
    });
    return created;
  };

  const clearAccount = async (accountId: string): Promise<void> => {
    const appPromise = appsByAccountId.get(accountId);
    if (appPromise === undefined) return;

    appsByAccountId.delete(accountId);
    try {
      await disposeApp(await appPromise);
    } catch {
      // A failed initialization has no reusable server state to retain.
    }
  };

  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    const appPromises = [...appsByAccountId.values()];
    appsByAccountId.clear();
    await Promise.all(appPromises.map(async appPromise => {
      try {
        await disposeApp(await appPromise);
      } catch {
        // Closing is best-effort so one failed account app cannot retain the rest.
      }
    }));
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

      const app = await appForAccount(account.id);
      delegateRequest(app, request, response, route.targetUrl);
    } catch {
      if (response.headersSent) response.destroy();
      else writeJson(response, 500, internalErrorBody);
    }

    return true;
  };

  return Object.assign(handle, { clearAccount, close });
};
