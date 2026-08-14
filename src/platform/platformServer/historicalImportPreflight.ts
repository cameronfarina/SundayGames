import type { PlatformNodeHttpAdmission } from "../platformNodeHttp.js";
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

export const createHistoricalImportPreflight = (
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
  admissions: PlatformAdmissions,
): PlatformNodeHttpAdmission => async request => {
  const runtime = runtimeHolder.current();
  const account = await accountForPreflight(runtime, request, options.now?.());
  if (account === null) return authRequiredResponse();
  const seasonId = pathSegmentsFor(request)?.[1] ?? "";
  const access = await canManageSeason(runtime, account.id, seasonId);
  if (access === "missing") return seasonNotFoundResponse();
  if (access === "denied") return sharedMutationDeniedResponse();
  const decision = admissions.historicalImportRequestAdmission.acquire({
    accountId: account.id,
    clientAddress: request.clientAddress ?? "unknown",
    now: options.now?.(),
  });
  if (decision.allowed) return decision.permit;
  const busy = decision.reason === "concurrency_limited";
  return rateLimitedResponse(
    decision.retryAfterMs,
    busy ? "historical_import_busy" : "rate_limited",
    busy
      ? "Another historical draft import is already being processed. Try again in a moment."
      : "Too many historical draft imports. Try again later.",
  );
};
