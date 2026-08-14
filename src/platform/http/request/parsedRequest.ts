import type { PlatformHttpRequest } from "../contracts.js";
import { bodyRecord, headerValue } from "./values.js";

export interface ParsedPlatformHttpRequest {
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

const queryRecordFor = (
  url: URL,
  query: Record<string, unknown> | undefined,
): Record<string, unknown> => {
  const searchQuery: Record<string, unknown> = {};
  for (const [key, value] of url.searchParams.entries()) searchQuery[key] = value;
  return { ...searchQuery, ...(query ?? {}) };
};

const bearerSessionToken = (authorization: string | undefined): string | undefined =>
  authorization?.match(/^Bearer\s+(.+)$/i)?.[1];

const sessionTokenFor = (request: PlatformHttpRequest): string =>
  request.sessionToken ??
  headerValue(request.headers, "x-session-token") ??
  headerValue(request.headers, "session-token") ??
  headerValue(request.headers, "sessiontoken") ??
  bearerSessionToken(headerValue(request.headers, "authorization")) ??
  "";

export const parsedRequestFor = (request: PlatformHttpRequest): ParsedPlatformHttpRequest => {
  const url = new URL(request.path, "http://mockd.local");
  return {
    method: request.method.toUpperCase(),
    segments: url.pathname.split("/").filter(Boolean).map(segment => decodeURIComponent(segment)),
    body: bodyRecord(request.body),
    query: queryRecordFor(url, request.query),
    headers: request.headers ?? {},
    clientAddress: request.clientAddress ?? "unknown",
    now: request.now,
    sessionToken: sessionTokenFor(request),
    signal: request.signal,
  };
};

const loopbackHostnames = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const hostnameForCookiePolicy = (hostHeader: string | undefined): string | undefined => {
  const host = hostHeader?.trim().toLowerCase();
  if (host === undefined || host.length === 0) return undefined;
  if (!host.startsWith("[")) return host.split(":")[0];
  const endBracketIndex = host.indexOf("]");
  return endBracketIndex === -1 ? host : host.slice(1, endBracketIndex);
};

export const secureSessionCookieFor = (request: PlatformHttpRequest): boolean => {
  if (request.isSecure === true) return true;
  const forwardedProto = headerValue(request.headers, "x-forwarded-proto")
    ?.split(",")[0]?.trim().toLowerCase();
  if (forwardedProto === "https") return true;
  const hostname = hostnameForCookiePolicy(headerValue(request.headers, "host"));
  return hostname === undefined || !loopbackHostnames.has(hostname);
};
