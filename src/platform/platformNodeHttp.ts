import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
  ServerResponse,
} from "node:http";
import { isIP } from "node:net";
import type {
  PlatformHttpErrorBody,
  PlatformHttpHandler,
  PlatformHttpRequest,
  PlatformHttpResponse,
} from "./platformHttp.js";
export {
  clearMockdSessionCookie,
  mockdSessionCookie,
  mockdSessionCookieName,
  type MockdSessionCookieOptions,
} from "./platformCookies.js";
import { mockdSessionCookieName } from "./platformCookies.js";

export const defaultPlatformJsonBodyLimitBytes = 1_048_576;

export interface PlatformNodeHttpAdapterOptions {
  appHtml?: string | undefined;
  draftRoomHtml?: string | undefined;
  maxBodyBytes?: number | undefined;
  trustProxy?: boolean | undefined;
}

export interface PlatformNodeHttpLogEntry {
  timestamp: string;
  level: "info" | "error";
  event: "http_request_completed" | "http_request_error";
  requestId: string;
  method: string;
  route: string;
  status: number;
  durationMs: number;
}

export interface ObservePlatformNodeHttpServerOptions {
  logger?: ((entry: PlatformNodeHttpLogEntry) => void) | undefined;
}

class InvalidJsonBodyError extends Error {}
class RequestBodyTooLargeError extends Error {}

const jsonContentType = "application/json; charset=utf-8";
const htmlContentType = "text/html; charset=utf-8";
const appShellPaths = new Set([
  "/",
  "/app",
  "/login",
  "/signup",
  "/invite",
  "/setup",
  "/league",
  "/board",
  "/mock-drafts",
  "/mock-results",
  "/simulations",
  "/strategy",
  "/my-expert",
  "/player-news",
]);
const draftWorkspacePaths = new Set(["/draft-room"]);
const observableRouteRoots = new Set([
  ...[...appShellPaths].map(path => path.slice(1)),
  ...[...draftWorkspacePaths].map(path => path.slice(1)),
  "accounts",
  "healthz",
  "historical-imports",
  "invitations",
  "jobs",
  "live-rooms",
  "mock-sessions",
  "onboarding",
  "pricing-snapshots",
  "readyz",
  "seasons",
  "session",
  "sessions",
]);
const observableHttpMethods = new Set([
  "DELETE",
  "GET",
  "HEAD",
  "OPTIONS",
  "PATCH",
  "POST",
  "PUT",
]);
const defaultSecurityHeaders = {
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
} as const;
const requestIds = new WeakMap<IncomingMessage, string>();

const ensurePlatformRequestId = (
  request: IncomingMessage,
  response: ServerResponse,
): string => {
  const existingRequestId = requestIds.get(request);
  if (existingRequestId !== undefined) {
    if (!response.headersSent && !response.hasHeader("X-Request-ID")) {
      response.setHeader("X-Request-ID", existingRequestId);
    }

    return existingRequestId;
  }

  const requestId = randomUUID();
  requestIds.set(request, requestId);
  response.setHeader("X-Request-ID", requestId);

  return requestId;
};

const observableMethodFor = (request: IncomingMessage): string => {
  const method = request.method?.toUpperCase() ?? "GET";

  return observableHttpMethods.has(method) ? method : "OTHER";
};

const observableRouteFor = (request: IncomingMessage): string => {
  try {
    const segments = new URL(request.url ?? "/", "http://mockd.local").pathname
      .split("/")
      .filter(Boolean);
    if (segments.length === 0) return "/";

    const root = segments[0] ?? "";
    if (!observableRouteRoots.has(root)) return "/<redacted>";

    return segments.length === 1 ? `/${root}` : `/${root}/*`;
  } catch {
    return "/<redacted>";
  }
};

const defaultPlatformNodeHttpLogger = (entry: PlatformNodeHttpLogEntry): void => {
  const serializedEntry = JSON.stringify(entry);
  if (entry.level === "error") console.error(serializedEntry);
  else console.log(serializedEntry);
};

export const observePlatformNodeHttpServer = (
  server: Server,
  options: ObservePlatformNodeHttpServerOptions = {},
): (() => void) => {
  const logger = options.logger ?? defaultPlatformNodeHttpLogger;
  const observeRequest = (request: IncomingMessage, response: ServerResponse): void => {
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
          timestamp: new Date().toISOString(),
          level,
          event,
          requestId,
          method,
          route,
          status,
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

  server.prependListener("request", observeRequest);

  return () => server.off("request", observeRequest);
};

const invalidJsonResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 400,
  body: {
    error: {
      code: "invalid_json",
      message: "Request body must be valid JSON.",
    },
  },
};

const requestBodyTooLargeResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 413,
  body: {
    error: {
      code: "request_body_too_large",
      message: "Request body exceeds the configured size limit.",
    },
  },
};

const firstHeaderValue = (value: string | readonly string[] | undefined): string | undefined => {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (value !== undefined) return value.find(candidate => candidate.length > 0);

  return undefined;
};

const headerValue = (
  headers: IncomingHttpHeaders,
  headerName: string,
): string | undefined => firstHeaderValue(headers[headerName]);

const decodeCookieValue = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const cookieSessionToken = (cookieHeader: string | undefined): string | undefined => {
  if (cookieHeader === undefined) return undefined;

  for (const cookie of cookieHeader.split(";")) {
    const separatorIndex = cookie.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = cookie.slice(0, separatorIndex).trim();
    const value = cookie.slice(separatorIndex + 1).trim();
    if (name === mockdSessionCookieName && value.length > 0) return decodeCookieValue(value);
  }

  return undefined;
};

const bearerSessionToken = (authorization: string | undefined): string | undefined => {
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  const token = match?.[1]?.trim();

  return token === "" ? undefined : token;
};

export const platformSessionTokenForHeaders = (headers: IncomingHttpHeaders): string | undefined =>
  cookieSessionToken(headerValue(headers, "cookie")) ??
  headerValue(headers, "x-session-token") ??
  bearerSessionToken(headerValue(headers, "authorization"));

const platformHeadersFor = (headers: IncomingHttpHeaders): Record<string, string | undefined> => {
  const platformHeaders: Record<string, string | undefined> = {};

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (
      lowerName === "authorization" ||
      lowerName === "cookie" ||
      lowerName === "session-token" ||
      lowerName === "sessiontoken" ||
      lowerName === "x-session-token"
    ) {
      continue;
    }

    platformHeaders[lowerName] = firstHeaderValue(value);
  }

  return platformHeaders;
};

const contentLengthFor = (headers: IncomingHttpHeaders): number | undefined => {
  const rawContentLength = headerValue(headers, "content-length");
  if (rawContentLength === undefined) return undefined;

  const contentLength = Number(rawContentLength);

  return Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : undefined;
};

const readJsonBody = async (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<unknown | undefined> => {
  const contentLength = contentLengthFor(request.headers);
  if (contentLength !== undefined && contentLength > maxBodyBytes) {
    request.resume();
    throw new RequestBodyTooLargeError();
  }

  const chunks: Buffer[] = [];
  let byteLength = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    byteLength += buffer.byteLength;

    if (byteLength > maxBodyBytes) {
      request.resume();
      throw new RequestBodyTooLargeError();
    }

    chunks.push(buffer);
  }

  if (byteLength === 0) return undefined;

  const bodyText = Buffer.concat(chunks, byteLength).toString("utf8");
  if (bodyText.trim().length === 0) return undefined;

  try {
    return JSON.parse(bodyText) as unknown;
  } catch {
    throw new InvalidJsonBodyError();
  }
};

const setDefaultSecurityHeaders = (response: ServerResponse): void => {
  for (const [name, value] of Object.entries(defaultSecurityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
};

const isDirectSecureRequest = (request: IncomingMessage): boolean =>
  "encrypted" in request.socket && request.socket.encrypted === true;

const validatedClientAddress = (rawAddress: string): string | undefined => {
  let address = rawAddress.trim();
  if (address.startsWith("\"") && address.endsWith("\"") && address.length >= 2) {
    address = address.slice(1, -1).trim();
  }

  const bracketedIpv6 = address.match(/^\[([^\]]+)\](?::\d+)?$/);
  if (bracketedIpv6?.[1] !== undefined) {
    return isIP(bracketedIpv6[1]) === 6 ? bracketedIpv6[1] : undefined;
  }

  if (isIP(address) !== 0) return address;

  const ipv4WithPort = address.match(/^(.+):(\d+)$/);
  const ipv4Address = ipv4WithPort?.[1];
  return ipv4Address !== undefined && isIP(ipv4Address) === 4
    ? ipv4Address
    : undefined;
};

const forwardedClientAddress = (headers: IncomingHttpHeaders): string | undefined => {
  const forwarded = headerValue(headers, "forwarded");
  if (forwarded !== undefined) {
    const firstHop = forwarded.split(",", 1)[0] ?? "";
    const forParameter = firstHop
      .split(";")
      .map(parameter => parameter.trim())
      .find(parameter => parameter.slice(0, parameter.indexOf("=")).trim().toLowerCase() === "for");
    const separatorIndex = forParameter?.indexOf("=") ?? -1;

    return separatorIndex >= 0
      ? validatedClientAddress(forParameter?.slice(separatorIndex + 1) ?? "")
      : undefined;
  }

  const xForwardedFor = headerValue(headers, "x-forwarded-for");
  if (xForwardedFor !== undefined) {
    return validatedClientAddress(xForwardedFor.split(",", 1)[0] ?? "");
  }

  const xRealIp = headerValue(headers, "x-real-ip");
  return xRealIp === undefined ? undefined : validatedClientAddress(xRealIp);
};

const clientAddressFor = (request: IncomingMessage, trustProxy: boolean): string | undefined =>
  trustProxy
    ? forwardedClientAddress(request.headers) ?? request.socket.remoteAddress
    : request.socket.remoteAddress;

const writeJsonResponse = (
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
): void => {
  const explicitContentType = Object.entries(platformResponse.headers ?? {})
    .find(([name]) => name.toLowerCase() === "content-type")?.[1];
  const contentType = firstHeaderValue(explicitContentType);
  const rawTextBody = typeof platformResponse.body === "string" ? platformResponse.body : undefined;
  if (rawTextBody !== undefined && contentType?.toLowerCase().startsWith("text/event-stream") === true) {
    response.statusCode = platformResponse.status;
    for (const [name, value] of Object.entries(platformResponse.headers ?? {})) {
      if (name.toLowerCase() !== "x-request-id" && value !== undefined) {
        response.setHeader(name, value);
      }
    }
    setDefaultSecurityHeaders(response);
    response.setHeader("Content-Length", Buffer.byteLength(rawTextBody));
    response.end(rawTextBody);
    return;
  }

  const body = JSON.stringify(platformResponse.body ?? null);

  response.statusCode = platformResponse.status;
  response.setHeader("Content-Type", jsonContentType);
  for (const [name, value] of Object.entries(platformResponse.headers ?? {})) {
    if (name.toLowerCase() !== "x-request-id" && value !== undefined) {
      response.setHeader(name, value);
    }
  }
  setDefaultSecurityHeaders(response);
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
};

const writeHtmlResponse = (
  response: ServerResponse,
  html: string,
): void => {
  response.statusCode = 200;
  response.setHeader("Content-Type", htmlContentType);
  setDefaultSecurityHeaders(response);
  response.setHeader("Content-Length", Buffer.byteLength(html));
  response.end(html);
};

const htmlForBrowserRequest = (
  request: IncomingMessage,
  appHtml: string | undefined,
  draftRoomHtml: string | undefined,
): string | undefined => {
  if (request.method !== "GET") return undefined;

  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    if (draftWorkspacePaths.has(pathname)) return draftRoomHtml ?? appHtml;
    if (appShellPaths.has(pathname)) return appHtml;

    return undefined;
  } catch {
    return undefined;
  }
};

const platformRequestFor = async (
  request: IncomingMessage,
  maxBodyBytes: number,
  trustProxy: boolean,
): Promise<PlatformHttpRequest> => {
  const sessionToken = platformSessionTokenForHeaders(request.headers);

  return {
    method: request.method ?? "GET",
    path: request.url ?? "/",
    body: await readJsonBody(request, maxBodyBytes),
    sessionToken,
    headers: platformHeadersFor(request.headers),
    isSecure: isDirectSecureRequest(request),
    clientAddress: clientAddressFor(request, trustProxy),
  };
};

export const createPlatformNodeHttpAdapter = (
  handle: PlatformHttpHandler,
  options: PlatformNodeHttpAdapterOptions = {},
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  const appHtml = options.appHtml;
  const draftRoomHtml = options.draftRoomHtml;
  const maxBodyBytes = options.maxBodyBytes ?? defaultPlatformJsonBodyLimitBytes;
  const trustProxy = options.trustProxy ?? false;

  return async (request, response) => {
    ensurePlatformRequestId(request, response);

    try {
      const browserHtml = htmlForBrowserRequest(request, appHtml, draftRoomHtml);
      if (browserHtml !== undefined) {
        writeHtmlResponse(response, browserHtml);
        return;
      }

      const platformRequest = await platformRequestFor(request, maxBodyBytes, trustProxy);
      const platformResponse = await handle(platformRequest);

      writeJsonResponse(response, platformResponse);
    } catch (error) {
      if (error instanceof RequestBodyTooLargeError) {
        writeJsonResponse(response, requestBodyTooLargeResponse);
        return;
      }

      if (error instanceof InvalidJsonBodyError) {
        writeJsonResponse(response, invalidJsonResponse);
        return;
      }

      writeJsonResponse(response, {
        status: 500,
        body: {
          error: {
            code: "internal_error",
            message: "Something went wrong.",
          },
        },
      });
    }
  };
};
