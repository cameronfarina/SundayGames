import type { IncomingHttpHeaders } from "node:http";

export const firstHeaderValue = (
  value: string | readonly string[] | undefined,
): string | undefined => {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (value !== undefined) return value.find(candidate => candidate.length > 0);
  return undefined;
};

export const headerValue = (
  headers: IncomingHttpHeaders,
  headerName: string,
): string | undefined => firstHeaderValue(headers[headerName]);

export const platformHeadersFor = (
  headers: IncomingHttpHeaders,
): Record<string, string | undefined> => {
  const platformHeaders: Record<string, string | undefined> = {};
  const privateHeaders = new Set([
    "authorization", "cookie", "session-token", "sessiontoken", "x-session-token",
  ]);

  for (const [name, value] of Object.entries(headers)) {
    const lowerName = name.toLowerCase();
    if (!privateHeaders.has(lowerName)) platformHeaders[lowerName] = firstHeaderValue(value);
  }
  return platformHeaders;
};

export const contentLengthFor = (headers: IncomingHttpHeaders): number | undefined => {
  const rawContentLength = headerValue(headers, "content-length");
  if (rawContentLength === undefined) return undefined;
  const contentLength = Number(rawContentLength);
  return Number.isFinite(contentLength) && contentLength >= 0 ? contentLength : undefined;
};
