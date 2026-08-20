import type { PlatformHttpRequest } from "../platformHttp.js";
import type { PlatformClock } from "./contracts.js";

const mutatingHttpMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);

export const isMutatingRequest = (request: PlatformHttpRequest): boolean =>
  mutatingHttpMethods.has(request.method.toUpperCase());

export const withTrustedNow = (
  request: PlatformHttpRequest,
  now: PlatformClock | undefined,
): PlatformHttpRequest => {
  const trustedNow = now?.() ?? request.now;
  if (trustedNow === undefined) return request;

  return { ...request, now: trustedNow };
};

export const shouldPersistAfter = (
  request: PlatformHttpRequest,
  responseStatus: number,
): boolean =>
  isMutatingRequest(request) &&
  responseStatus >= 200 &&
  responseStatus < 300;
