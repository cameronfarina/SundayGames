import type { PlatformNodeHttpAdmission } from "../platformNodeHttp.js";
import type { PlatformAdmissions } from "./admissions.js";
import type { CreatePlatformServerOptions } from "./contracts.js";
import type { PlatformRuntimeHolder } from "./internalContracts.js";
import { accountForPreflight } from "./preflightAccount.js";
import { authRequiredResponse, rateLimitedResponse } from "./preflightResponses.js";

export const createSimulationCompletionPreflight = (
  runtimeHolder: PlatformRuntimeHolder,
  options: CreatePlatformServerOptions,
  admissions: PlatformAdmissions,
): PlatformNodeHttpAdmission => async request => {
  const account = await accountForPreflight(runtimeHolder.current(), request, options.now?.());
  if (account === null) return authRequiredResponse();
  const decision = admissions.simulationCompletionRequestAdmission.acquire({
    accountId: account.id,
    clientAddress: request.clientAddress ?? "unknown",
  });
  return decision.allowed ? decision.permit : rateLimitedResponse(
    decision.retryAfterMs,
    "simulation_completion_busy",
    "Another simulation result is being saved. Try again in a moment.",
  );
};
