import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { observableHttpMethods, observableRouteRoots } from "./constants.js";
import type {
  ObservePlatformNodeHttpServerOptions,
  PlatformNodeHttpLogEntry,
} from "./contracts.js";
import { ensurePlatformRequestId } from "./requestId.js";

const observableMethodFor = (request: IncomingMessage): string => {
  const method = request.method?.toUpperCase() ?? "GET";
  return observableHttpMethods.has(method) ? method : "OTHER";
};

const observableRouteFor = (request: IncomingMessage): string => {
  try {
    const segments = new URL(request.url ?? "/", "http://mockd.local").pathname
      .split("/").filter(Boolean);
    if (segments.length === 0) return "/";
    const root = segments[0] ?? "";
    if (!observableRouteRoots.has(root)) return "/<redacted>";
    return segments.length === 1 ? `/${root}` : `/${root}/*`;
  } catch {
    return "/<redacted>";
  }
};

const defaultLogger = (entry: PlatformNodeHttpLogEntry): void => {
  const serializedEntry = JSON.stringify(entry);
  if (entry.level === "error") console.error(serializedEntry);
  else console.log(serializedEntry);
};

const observeRequestWith = (
  logger: (entry: PlatformNodeHttpLogEntry) => void,
  request: IncomingMessage,
  response: ServerResponse,
): void => {
  const requestId = ensurePlatformRequestId(request, response);
  const method = observableMethodFor(request);
  const route = observableRouteFor(request);
  const startedAt = Date.now();
  let logged = false;

  const logCompletion = (
    level: PlatformNodeHttpLogEntry["level"],
    event: PlatformNodeHttpLogEntry["event"],
    status: number,
  ): void => {
    if (logged) return;
    logged = true;
    try {
      logger({
        timestamp: new Date().toISOString(), level, event, requestId, method, route, status,
        durationMs: Math.max(0, Date.now() - startedAt),
      });
    } catch {
      // Observability must never break request handling.
    }
  };

  response.once("finish", () => {
    const isServerError = response.statusCode >= 500;
    logCompletion(
      isServerError ? "error" : "info",
      isServerError ? "http_request_error" : "http_request_completed",
      response.statusCode,
    );
  });
  response.once("close", () => {
    if (!response.writableFinished) logCompletion("error", "http_request_error", 499);
  });
  response.once("error", () => {
    logCompletion("error", "http_request_error", response.statusCode || 500);
  });
};

export const observePlatformNodeHttpServer = (
  server: Server,
  options: ObservePlatformNodeHttpServerOptions = {},
): (() => void) => {
  const logger = options.logger ?? defaultLogger;
  const observeRequest = (request: IncomingMessage, response: ServerResponse): void => {
    observeRequestWith(logger, request, response);
  };
  server.prependListener("request", observeRequest);
  return () => server.off("request", observeRequest);
};
