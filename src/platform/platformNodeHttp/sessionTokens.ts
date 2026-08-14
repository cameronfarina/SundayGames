import type { IncomingHttpHeaders } from "node:http";
import { mockdSessionCookieName } from "../platformCookies.js";
import { headerValue } from "./headers.js";

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

export const platformSessionTokenForHeaders = (
  headers: IncomingHttpHeaders,
): string | undefined => cookieSessionToken(headerValue(headers, "cookie"))
  ?? headerValue(headers, "x-session-token")
  ?? bearerSessionToken(headerValue(headers, "authorization"));
