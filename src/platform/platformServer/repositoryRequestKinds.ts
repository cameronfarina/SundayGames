import type { PlatformHttpRequest } from "../platformHttp.js";
import { pathSegmentsFor } from "./requestPath.js";

export const isAccountOnboardingOnlyMutationRequest = (
  request: PlatformHttpRequest,
): boolean => {
  const segments = pathSegmentsFor(request);
  return request.method.toUpperCase() === "PUT" && segments?.length === 1
    && segments[0] === "account-onboarding";
};

export const isAuthOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  const method = request.method.toUpperCase();
  const segments = pathSegmentsFor(request);
  if (segments === null) return false;
  if (segments.length === 1 && method === "POST") {
    return segments[0] === "accounts" || segments[0] === "sessions" ||
      segments[0] === "email-verifications" || segments[0] === "password-resets";
  }
  if (segments.length === 1 && method === "DELETE") return segments[0] === "session";
  if (segments.length === 2 && method === "PUT") {
    return segments[0] === "session" && segments[1] === "password";
  }
  return method === "POST" && segments.length === 2 &&
    (segments[0] === "email-verifications" || segments[0] === "password-resets") &&
    segments[1] === "consume";
};

export const isLeagueSetupOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  const method = request.method.toUpperCase();
  if (method !== "POST" && method !== "PUT") return false;
  const segments = pathSegmentsFor(request);
  if (segments === null) return false;
  if (method === "POST" && segments.length === 1) {
    return segments[0] === "seasons" || segments[0] === "leagues";
  }
  if (method === "PUT" && segments.length === 2 && segments[0] === "seasons") return true;
  if (method === "POST" && segments.length === 3 &&
      segments[0] === "seasons" && segments[2] === "publish") return true;
  return method === "POST" && segments.length === 4 &&
    segments[0] === "seasons" && segments[2] === "setup-import";
};

export const isHistoricalImportOnlyMutationRequest = (request: PlatformHttpRequest): boolean => {
  if (request.method.toUpperCase() !== "POST") return false;
  const segments = pathSegmentsFor(request);
  return segments !== null && segments.length === 4 && segments[0] === "seasons" &&
    segments[2] === "historical-imports" && segments[3] === "preview";
};
