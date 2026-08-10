import { Buffer } from "node:buffer";
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from "node:http";
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
}

class InvalidJsonBodyError extends Error {}
class RequestBodyTooLargeError extends Error {}

const jsonContentType = "application/json; charset=utf-8";
const htmlContentType = "text/html; charset=utf-8";
const authShellPaths = new Set(["/", "/app", "/login", "/signup"]);
const draftWorkspacePaths = new Set(["/draft-room", "/mock-results", "/my-expert", "/player-news"]);

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

const sessionTokenFor = (headers: IncomingHttpHeaders): string | undefined =>
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
      if (value !== undefined) response.setHeader(name, value);
    }
    response.setHeader("Content-Length", Buffer.byteLength(rawTextBody));
    response.end(rawTextBody);
    return;
  }

  const body = JSON.stringify(platformResponse.body ?? null);

  response.statusCode = platformResponse.status;
  response.setHeader("Content-Type", jsonContentType);
  for (const [name, value] of Object.entries(platformResponse.headers ?? {})) {
    if (value !== undefined) response.setHeader(name, value);
  }
  response.setHeader("Content-Length", Buffer.byteLength(body));
  response.end(body);
};

const writeHtmlResponse = (
  response: ServerResponse,
  html: string,
): void => {
  response.statusCode = 200;
  response.setHeader("Content-Type", htmlContentType);
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
    if (authShellPaths.has(pathname)) return appHtml;

    return undefined;
  } catch {
    return undefined;
  }
};

const platformRequestFor = async (
  request: IncomingMessage,
  maxBodyBytes: number,
): Promise<PlatformHttpRequest> => {
  const sessionToken = sessionTokenFor(request.headers);

  return {
    method: request.method ?? "GET",
    path: request.url ?? "/",
    body: await readJsonBody(request, maxBodyBytes),
    sessionToken,
    headers: platformHeadersFor(request.headers),
  };
};

export const createPlatformNodeHttpAdapter = (
  handle: PlatformHttpHandler,
  options: PlatformNodeHttpAdapterOptions = {},
): ((request: IncomingMessage, response: ServerResponse) => Promise<void>) => {
  const appHtml = options.appHtml;
  const draftRoomHtml = options.draftRoomHtml;
  const maxBodyBytes = options.maxBodyBytes ?? defaultPlatformJsonBodyLimitBytes;

  return async (request, response) => {
    try {
      const browserHtml = htmlForBrowserRequest(request, appHtml, draftRoomHtml);
      if (browserHtml !== undefined) {
        writeHtmlResponse(response, browserHtml);
        return;
      }

      const platformRequest = await platformRequestFor(request, maxBodyBytes);
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
