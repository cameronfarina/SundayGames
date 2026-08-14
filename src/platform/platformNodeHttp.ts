import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  Server,
  ServerResponse,
} from "node:http";
import { isIP } from "node:net";
import {
  brotliCompress,
  brotliCompressSync,
  constants as zlibConstants,
  gzip,
  gzipSync,
} from "node:zlib";
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
import type { PlatformBrowserAsset } from "./platformStaticWebAssets.js";

export const defaultPlatformJsonBodyLimitBytes = 1_048_576;
export const defaultPlatformScreenshotImportBodyLimitBytes = 7_100_000;

export interface PlatformNodeHttpAdapterOptions {
  appHtml?: string | undefined;
  browserAssets?: ReadonlyMap<string, PlatformBrowserAsset> | undefined;
  maxBodyBytes?: number | undefined;
  screenshotImportMaxBodyBytes?: number | undefined;
  screenshotImportPreflight?: PlatformNodeHttpPreflight | undefined;
  historicalImportPreflight?: PlatformNodeHttpAdmission | undefined;
  trustProxy?: boolean | undefined;
}

export type PlatformNodeHttpPreflight = (
  request: PlatformHttpRequest,
) => Promise<PlatformHttpResponse | null>;

export interface PlatformNodeHttpAdmissionPermit {
  release(): void;
}

export type PlatformNodeHttpAdmission = (
  request: PlatformHttpRequest,
) => Promise<PlatformHttpResponse | PlatformNodeHttpAdmissionPermit>;

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
const minimumCompressionBodyBytes = 1_024;
const dynamicBrotliQuality = 4;
const dynamicGzipLevel = 6;
const staticBrotliQuality = 8;
type ContentEncoding = "br" | "gzip";

interface PreparedBrowserAsset {
  readonly brotliBody?: Buffer | undefined;
  readonly gzipBody?: Buffer | undefined;
  readonly source: PlatformBrowserAsset;
}
const appShellPaths = new Set([
  "/",
  "/app",
  "/login",
  "/signup",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/invite",
  "/setup",
  "/league",
  "/commissioner",
  "/draft-room",
  "/practice",
  "/my-team",
  "/mock-drafts",
  "/mock-results",
  "/simulations",
  "/strategy",
  "/my-expert",
  "/player-news",
]);
const legacyProductRedirects: ReadonlyMap<string, string> = new Map([
  ["/board", "/practice"],
  ["/mock-results", "/mock-drafts"],
  ["/simulations", "/practice"],
  ["/strategy", "/mock-drafts"],
  ["/my-expert", "/my-team"],
  ["/player-news", "/practice"],
  ["/setup", "/commissioner"],
]);
const observableRouteRoots = new Set([
  ...[...appShellPaths].map(path => path.slice(1)),
  "accounts",
  "email-verifications",
  "healthz",
  "historical-imports",
  "invitations",
  "jobs",
  "league-imports",
  "leagues",
  "live-rooms",
  "mock-sessions",
  "onboarding",
  "player-catalog",
  "password-resets",
  "pricing-snapshots",
  "readyz",
  "season-mock-drafts",
  "season-simulations",
  "practice-shortlist",
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
};
const htmlSecurityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'",
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "manifest-src 'self'",
    "worker-src 'self' blob:",
  ].join("; "),
  "Permissions-Policy": [
    "camera=()",
    "display-capture=()",
    "geolocation=()",
    "microphone=()",
    "payment=()",
    "usb=()",
  ].join(", "),
  "X-Frame-Options": "DENY",
};
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

const screenshotImportPreflightUnavailableResponse: PlatformHttpResponse<PlatformHttpErrorBody> = {
  status: 503,
  body: {
    error: {
      code: "screenshot_import_unavailable",
      message: "Screenshot import is not configured for this deployment.",
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

const encodingQuality = (value: string): number => {
  const qualityParameter = value
    .split(";")
    .slice(1)
    .map(parameter => parameter.trim())
    .find(parameter => parameter.toLowerCase().startsWith("q="));
  if (qualityParameter === undefined) return 1;
  const quality = Number(qualityParameter.slice(2));

  return Number.isFinite(quality) && quality >= 0 && quality <= 1 ? quality : 0;
};

const preferredContentEncoding = (headers: IncomingHttpHeaders): ContentEncoding | undefined => {
  const acceptEncoding = headerValue(headers, "accept-encoding");
  if (acceptEncoding === undefined) return undefined;

  const qualities = new Map<string, number>();
  for (const value of acceptEncoding.split(",")) {
    const name = value.trim().split(";", 1)[0]?.toLowerCase();
    if (name !== undefined && name !== "") qualities.set(name, encodingQuality(value));
  }
  const wildcardQuality = qualities.get("*") ?? 0;
  const brotliQuality = qualities.get("br") ?? wildcardQuality;
  const gzipQuality = qualities.get("gzip") ?? wildcardQuality;
  const identityQuality = qualities.get("identity");
  if (brotliQuality <= 0 && gzipQuality <= 0) return undefined;
  if (identityQuality !== undefined && identityQuality > Math.max(brotliQuality, gzipQuality)) {
    return undefined;
  }

  return brotliQuality >= gzipQuality ? "br" : "gzip";
};

const brotliBody = async (body: Buffer): Promise<Buffer> => await new Promise(
  (resolve, reject) => {
    brotliCompress(body, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: dynamicBrotliQuality },
    }, (error, compressedBody) => {
      if (error === null) resolve(compressedBody);
      else reject(error);
    });
  },
);

const gzipBody = async (body: Buffer): Promise<Buffer> => await new Promise(
  (resolve, reject) => {
    gzip(body, { level: dynamicGzipLevel }, (error, compressedBody) => {
      if (error === null) resolve(compressedBody);
      else reject(error);
    });
  },
);

const setVaryAcceptEncoding = (response: ServerResponse): void => {
  const existingVary = response.getHeader("Vary");
  const values = Array.isArray(existingVary)
    ? existingVary
    : typeof existingVary === "string"
      ? existingVary.split(",")
      : [];
  if (!values.some(value => value.trim().toLowerCase() === "accept-encoding")) {
    response.setHeader("Vary", [...values, "Accept-Encoding"]);
  }
};

const isCompressibleContentType = (contentType: string): boolean => {
  const mimeType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";

  return mimeType.startsWith("text/")
    || mimeType === "application/javascript"
    || mimeType === "application/json"
    || mimeType === "application/manifest+json"
    || mimeType === "application/xml"
    || mimeType.endsWith("+json")
    || mimeType.endsWith("+xml")
    || mimeType === "image/svg+xml";
};

const prepareBrowserAssets = (
  browserAssets: ReadonlyMap<string, PlatformBrowserAsset> | undefined,
): ReadonlyMap<string, PreparedBrowserAsset> | undefined => {
  if (browserAssets === undefined) return undefined;

  const preparedAssets = new Map<string, PreparedBrowserAsset>();
  for (const [path, asset] of browserAssets) {
    if (
      asset.body.byteLength < minimumCompressionBodyBytes
      || !isCompressibleContentType(asset.contentType)
    ) {
      preparedAssets.set(path, { source: asset });
      continue;
    }
    const brotli = brotliCompressSync(asset.body, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: staticBrotliQuality },
    });
    const gzipped = gzipSync(asset.body, { level: dynamicGzipLevel });
    preparedAssets.set(path, {
      source: asset,
      ...(brotli.byteLength < asset.body.byteLength ? { brotliBody: brotli } : {}),
      ...(gzipped.byteLength < asset.body.byteLength ? { gzipBody: gzipped } : {}),
    });
  }

  return preparedAssets;
};

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

const setHtmlSecurityHeaders = (response: ServerResponse): void => {
  setDefaultSecurityHeaders(response);
  for (const [name, value] of Object.entries(htmlSecurityHeaders)) {
    if (!response.hasHeader(name)) response.setHeader(name, value);
  }
};

const cacheControlPreventsStorage = (response: ServerResponse): boolean => {
  const cacheControl = response.getHeader("Cache-Control");
  if (typeof cacheControl === "string") {
    return cacheControl
      .split(",")
      .some(directive => directive.trim().toLowerCase() === "no-store");
  }
  if (Array.isArray(cacheControl)) {
    return cacheControl.some(value => value
      .split(",")
      .some(directive => directive.trim().toLowerCase() === "no-store"));
  }

  return false;
};

const setPrivateNoStoreCacheControl = (response: ServerResponse): void => {
  if (!cacheControlPreventsStorage(response)) {
    response.setHeader("Cache-Control", "private, no-store");
  }
};

const isDirectSecureRequest = (request: IncomingMessage): boolean =>
  "encrypted" in request.socket && request.socket.encrypted === true;

const normalizedProtocol = (value: string): string => {
  const trimmed = value.trim();
  const unquoted = trimmed.startsWith("\"") && trimmed.endsWith("\"")
    ? trimmed.slice(1, -1)
    : trimmed;

  return unquoted.trim().toLowerCase();
};

const trustedForwardedProtocol = (headers: IncomingHttpHeaders): string | undefined => {
  const forwarded = headerValue(headers, "forwarded");
  if (forwarded !== undefined) {
    const firstHop = forwarded.split(",", 1)[0] ?? "";
    for (const parameter of firstHop.split(";")) {
      const separatorIndex = parameter.indexOf("=");
      if (separatorIndex === -1) continue;
      if (parameter.slice(0, separatorIndex).trim().toLowerCase() === "proto") {
        return normalizedProtocol(parameter.slice(separatorIndex + 1));
      }
    }
  }

  const xForwardedProto = headerValue(headers, "x-forwarded-proto");
  return xForwardedProto === undefined
    ? undefined
    : normalizedProtocol(xForwardedProto.split(",", 1)[0] ?? "");
};

const isSecureRequest = (request: IncomingMessage, trustProxy: boolean): boolean =>
  isDirectSecureRequest(request)
  || (trustProxy && trustedForwardedProtocol(request.headers) === "https");

const setTransportSecurityHeader = (
  request: IncomingMessage,
  response: ServerResponse,
  trustProxy: boolean,
): void => {
  if (isSecureRequest(request, trustProxy) && !response.hasHeader("Strict-Transport-Security")) {
    response.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
};

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
  const cloudflareConnectingIp = headerValue(headers, "cf-connecting-ip");
  if (cloudflareConnectingIp !== undefined) {
    return validatedClientAddress(cloudflareConnectingIp);
  }

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

const isAsyncTextStream = (body: unknown): body is AsyncIterable<string> =>
  body !== null
  && typeof body === "object"
  && Symbol.asyncIterator in body;

const writeJsonResponse = async (
  request: IncomingMessage,
  response: ServerResponse,
  platformResponse: PlatformHttpResponse,
): Promise<void> => {
  const explicitContentType = Object.entries(platformResponse.headers ?? {})
    .find(([name]) => name.toLowerCase() === "content-type")?.[1];
  const contentType = firstHeaderValue(explicitContentType);
  if (isAsyncTextStream(platformResponse.body)) {
    response.statusCode = platformResponse.status;
    for (const [name, value] of Object.entries(platformResponse.headers ?? {})) {
      if (name.toLowerCase() !== "x-request-id" && value !== undefined) {
        response.setHeader(name, value);
      }
    }
    setDefaultSecurityHeaders(response);
    response.flushHeaders();
    for await (const chunk of platformResponse.body) {
      if (response.destroyed) return;
      if (!response.write(chunk)) {
        await new Promise<void>(resolve => {
          const resume = (): void => {
            response.removeListener("drain", resume);
            response.removeListener("close", resume);
            resolve();
          };
          response.once("drain", resume);
          response.once("close", resume);
        });
      }
    }
    if (!response.destroyed) response.end();
    return;
  }
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

  const serializedBody = JSON.stringify(platformResponse.body ?? null);
  const rawBody = Buffer.from(serializedBody);
  const shouldCompress = rawBody.byteLength >= minimumCompressionBodyBytes;
  const contentEncoding = shouldCompress
    ? preferredContentEncoding(request.headers)
    : undefined;
  const body = contentEncoding === "br"
    ? await brotliBody(rawBody)
    : contentEncoding === "gzip"
      ? await gzipBody(rawBody)
      : rawBody;

  response.statusCode = platformResponse.status;
  response.setHeader("Content-Type", jsonContentType);
  for (const [name, value] of Object.entries(platformResponse.headers ?? {})) {
    if (name.toLowerCase() !== "x-request-id" && value !== undefined) {
      response.setHeader(name, value);
    }
  }
  setDefaultSecurityHeaders(response);
  setPrivateNoStoreCacheControl(response);
  if (shouldCompress) setVaryAcceptEncoding(response);
  if (contentEncoding !== undefined) response.setHeader("Content-Encoding", contentEncoding);
  response.setHeader("Content-Length", body.byteLength);
  response.end(body);
};

const writeHtmlResponse = (
  response: ServerResponse,
  html: string,
): void => {
  response.statusCode = 200;
  response.setHeader("Content-Type", htmlContentType);
  setHtmlSecurityHeaders(response);
  response.setHeader("Content-Length", Buffer.byteLength(html));
  response.end(html);
};

const writeBrowserAssetResponse = (
  request: IncomingMessage,
  response: ServerResponse,
  asset: PreparedBrowserAsset,
): void => {
  const contentEncoding = preferredContentEncoding(request.headers);
  const body = contentEncoding === "br" && asset.brotliBody !== undefined
    ? asset.brotliBody
    : contentEncoding === "gzip" && asset.gzipBody !== undefined
      ? asset.gzipBody
      : asset.source.body;
  const selectedEncoding = body === asset.brotliBody
    ? "br"
    : body === asset.gzipBody
      ? "gzip"
      : undefined;
  response.statusCode = 200;
  response.setHeader("Cache-Control", asset.source.cacheControl);
  response.setHeader("Content-Type", asset.source.contentType);
  setDefaultSecurityHeaders(response);
  if (asset.brotliBody !== undefined || asset.gzipBody !== undefined) {
    setVaryAcceptEncoding(response);
  }
  if (selectedEncoding !== undefined) response.setHeader("Content-Encoding", selectedEncoding);
  response.setHeader("Content-Length", body.byteLength);
  response.end(request.method === "HEAD" ? undefined : body);
};

const browserAssetForRequest = (
  request: IncomingMessage,
  browserAssets: ReadonlyMap<string, PreparedBrowserAsset> | undefined,
): PreparedBrowserAsset | undefined => {
  if (request.method !== "GET" && request.method !== "HEAD") return undefined;

  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return browserAssets?.get(pathname);
  } catch {
    return undefined;
  }
};

const htmlForBrowserRequest = (
  request: IncomingMessage,
  appHtml: string | undefined,
): string | undefined => {
  if (request.method !== "GET") return undefined;

  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    if (appShellPaths.has(pathname)) return appHtml;

    return undefined;
  } catch {
    return undefined;
  }
};

const redirectForBrowserRequest = (request: IncomingMessage): string | undefined => {
  if (request.method !== "GET") return undefined;

  try {
    const source = new URL(request.url ?? "/", "http://mockd.local");
    const targetPath = legacyProductRedirects.get(source.pathname);
    if (targetPath === undefined) return undefined;
    const legacySeasonId = source.searchParams.get("contextSeasonId");
    if (legacySeasonId !== null && !source.searchParams.has("seasonId")) {
      source.searchParams.set("seasonId", legacySeasonId);
    }
    source.searchParams.delete("contextSeasonId");
    return `${targetPath}${source.search}`;
  } catch {
    return undefined;
  }
};

const platformRequestMetadataFor = (
  request: IncomingMessage,
  trustProxy: boolean,
  signal?: AbortSignal,
): PlatformHttpRequest => {
  const sessionToken = platformSessionTokenForHeaders(request.headers);

  return {
    method: request.method ?? "GET",
    path: request.url ?? "/",
    sessionToken,
    headers: platformHeadersFor(request.headers),
    isSecure: isSecureRequest(request, trustProxy),
    clientAddress: clientAddressFor(request, trustProxy),
    ...(signal === undefined ? {} : { signal }),
  };
};

const platformRequestFor = async (
  request: IncomingMessage,
  maxBodyBytes: number,
  trustProxy: boolean,
  signal?: AbortSignal,
): Promise<PlatformHttpRequest> => ({
  ...platformRequestMetadataFor(request, trustProxy, signal),
  body: await readJsonBody(request, maxBodyBytes),
});

const isScreenshotImportAnalysisRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;

  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return /^\/seasons\/[^/]+\/setup-import\/screenshot-analyze$/u.test(pathname) ||
      pathname === "/league-imports/espn/members-screenshot-review";
  } catch {
    return false;
  }
};

const isHistoricalSpreadsheetUploadRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;
  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return /^\/seasons\/[^/]+\/historical-imports\/upload-preview$/u.test(pathname);
  } catch {
    return false;
  }
};

const isHistoricalImportPreviewRequest = (request: IncomingMessage): boolean => {
  if (request.method?.toUpperCase() !== "POST") return false;
  try {
    const pathname = new URL(request.url ?? "/", "http://mockd.local").pathname;
    return /^\/seasons\/[^/]+\/historical-imports\/(?:preview|upload-preview)$/u.test(pathname);
  } catch {
    return false;
  }
};

const isPlatformHttpResponse = (
  result: PlatformHttpResponse | PlatformNodeHttpAdmissionPermit,
): result is PlatformHttpResponse => "status" in result;

const bodyLimitForRequest = (
  request: IncomingMessage,
  defaultLimit: number,
  screenshotImportLimit: number,
): number => isScreenshotImportAnalysisRequest(request)
  || isHistoricalSpreadsheetUploadRequest(request)
    ? screenshotImportLimit
    : defaultLimit;

export const createPlatformNodeHttpAdapter = (
  handle: PlatformHttpHandler,
  options: PlatformNodeHttpAdapterOptions = {},
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  const appHtml = options.appHtml;
  const browserAssets = prepareBrowserAssets(options.browserAssets);
  const maxBodyBytes = options.maxBodyBytes ?? defaultPlatformJsonBodyLimitBytes;
  const screenshotImportMaxBodyBytes = options.screenshotImportMaxBodyBytes
    ?? defaultPlatformScreenshotImportBodyLimitBytes;
  const screenshotImportPreflight = options.screenshotImportPreflight;
  const historicalImportPreflight = options.historicalImportPreflight;
  const trustProxy = options.trustProxy ?? false;

  return async (request, response) => {
    ensurePlatformRequestId(request, response);
    setTransportSecurityHeader(request, response, trustProxy);

    try {
      const browserRedirect = redirectForBrowserRequest(request);
      if (browserRedirect !== undefined) {
        setDefaultSecurityHeaders(response);
        response.writeHead(302, { "Content-Length": "0", Location: browserRedirect });
        response.end();
        return;
      }
      const browserAsset = browserAssetForRequest(request, browserAssets);
      if (browserAsset !== undefined) {
        writeBrowserAssetResponse(request, response, browserAsset);
        return;
      }
      const browserHtml = htmlForBrowserRequest(request, appHtml);
      if (browserHtml !== undefined) {
        writeHtmlResponse(response, browserHtml);
        return;
      }

      if (isScreenshotImportAnalysisRequest(request)) {
        const preflightResponse = screenshotImportPreflight === undefined
          ? screenshotImportPreflightUnavailableResponse
          : await screenshotImportPreflight(platformRequestMetadataFor(request, trustProxy));
        if (preflightResponse !== null) {
          response.shouldKeepAlive = false;
          response.setHeader("Connection", "close");
          await writeJsonResponse(request, response, preflightResponse);
          return;
        }
      }

      let historicalImportPermit: PlatformNodeHttpAdmissionPermit | undefined;
      if (isHistoricalImportPreviewRequest(request) && historicalImportPreflight !== undefined) {
        const admission = await historicalImportPreflight(
          platformRequestMetadataFor(request, trustProxy),
        );
        if (isPlatformHttpResponse(admission)) {
          response.shouldKeepAlive = false;
          response.setHeader("Connection", "close");
          await writeJsonResponse(request, response, admission);
          return;
        }
        historicalImportPermit = admission;
      }

      const requestAbort = new AbortController();
      const abortForIncompleteRequest = (): void => requestAbort.abort();
      const abortForClosedResponse = (): void => {
        if (!response.writableEnded) requestAbort.abort();
      };
      request.once("aborted", abortForIncompleteRequest);
      response.once("close", abortForClosedResponse);
      try {
        const platformRequest = await platformRequestFor(
          request,
          bodyLimitForRequest(request, maxBodyBytes, screenshotImportMaxBodyBytes),
          trustProxy,
          requestAbort.signal,
        );
        const platformResponse = await handle(platformRequest);

        if (!response.destroyed) await writeJsonResponse(request, response, platformResponse);
      } finally {
        historicalImportPermit?.release();
        request.removeListener("aborted", abortForIncompleteRequest);
        response.removeListener("close", abortForClosedResponse);
      }
    } catch (error) {
      if (response.headersSent) {
        if (!response.destroyed && !response.writableEnded) response.end();
        return;
      }
      if (error instanceof RequestBodyTooLargeError) {
        await writeJsonResponse(request, response, requestBodyTooLargeResponse);
        return;
      }

      if (error instanceof InvalidJsonBodyError) {
        await writeJsonResponse(request, response, invalidJsonResponse);
        return;
      }

      await writeJsonResponse(request, response, {
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
