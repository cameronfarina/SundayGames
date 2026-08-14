import type { PlatformNodeHttpPreflight } from "../platformNodeHttp.js";
import type { PlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { accountForPreflight, canManageSeason } from "./preflightAccount.js";
import {
  authRequiredResponse,
  rateLimitedResponse,
  seasonNotFoundResponse,
  sharedMutationDeniedResponse,
} from "./preflightResponses.js";
import { pathSegmentsFor } from "./requestPath.js";

export const createScreenshotImportPreflight = (
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
  admissions: PlatformAdmissions,
): PlatformNodeHttpPreflight => async request => {
  const runtime = runtimeHolder.current();
  const account = await accountForPreflight(runtime, request, options.now?.());
  if (account === null) return authRequiredResponse();
  const segments = pathSegmentsFor(request);
  const leagueCreation = segments?.length === 3 && segments[0] === "league-imports" &&
    segments[1] === "espn" && segments[2] === "members-screenshot-review";
  if (leagueCreation) {
    const key = `${account.id}:league-create:${request.clientAddress ?? "unknown"}`;
    const decision = admissions.screenshotImportIngressRateLimiter.consume(key, options.now?.());
    return decision.allowed ? null : rateLimitedResponse(decision.retryAfterMs);
  }
  const seasonId = segments?.[1] ?? "";
  const access = await canManageSeason(runtime, account.id, seasonId);
  if (access === "missing") return seasonNotFoundResponse();
  if (access === "denied") return sharedMutationDeniedResponse();
  const key = `${account.id}:${seasonId}:${request.clientAddress ?? "unknown"}`;
  const decision = admissions.screenshotImportIngressRateLimiter.consume(key, options.now?.());
  return decision.allowed ? null : rateLimitedResponse(decision.retryAfterMs);
};
