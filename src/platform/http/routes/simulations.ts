import { simulationStrategyInputFromUnknown } from "../../simulationHttpInput.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../contracts.js";
import { requireRequestAccount } from "../auth/access.js";
import { actionRateLimitResponse } from "../auth/rateLimits.js";
import type { ParsedPlatformHttpRequest } from "../request/parsedRequest.js";
import { optionalNumber, optionalString, stringValue } from "../request/values.js";
import { methodNotAllowed, notFound } from "../responses.js";

export const routeSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const [, runId, action] = request.segments;
  if (request.segments.length === 1) {
    if (request.method === "GET") {
      const simulations = await app.listSimulationRuns({ actorSessionToken: request.sessionToken, now: request.now });
      return { status: 200, body: { simulations } };
    }
    if (request.method === "POST") {
      const simulation = await app.createSimulationRun({
        actorSessionToken: request.sessionToken,
        leagueId: stringValue(request.body.leagueId),
        seasonId: stringValue(request.body.seasonId),
        ownerId: stringValue(request.body.ownerId),
        teamId: stringValue(request.body.teamId),
        count: optionalNumber(request.body.count) ?? Number.NaN,
        seedPrefix: stringValue(request.body.seedPrefix),
        idempotencyKey: stringValue(request.body.idempotencyKey),
        strategy: simulationStrategyInputFromUnknown(request.body.strategy),
        now: request.now,
      });
      return { status: 201, body: { simulation } };
    }
    return methodNotAllowed();
  }
  if (request.segments.length === 2) {
    if (request.method !== "GET") return methodNotAllowed();
    const simulation = await app.getSimulationRun({ actorSessionToken: request.sessionToken, runId: runId ?? "", now: request.now });
    return { status: 200, body: { simulation } };
  }
  if (request.segments.length === 3 && action === "execute") {
    if (request.method !== "POST") return methodNotAllowed();
    const account = await requireRequestAccount(app, request);
    const limited = actionRateLimitResponse(
      request, services.simulationRateLimiter, `${account.id}:legacy-simulation`,
      "Too many simulation runs. Try again later.",
    );
    if (limited !== null) return limited;
    const simulation = await app.executeSimulationRun({ actorSessionToken: request.sessionToken, runId: runId ?? "", now: request.now });
    return { status: 200, body: { simulation } };
  }
  if (request.segments.length === 3 && (action === "jobs" || action === "enqueue")) {
    if (request.method !== "POST") return methodNotAllowed();
    const job = await app.enqueueSimulationRunExecutionJob({
      actorSessionToken: request.sessionToken,
      runId: runId ?? "",
      idempotencyKey: optionalString(request.body.idempotencyKey),
      now: request.now,
    });
    return { status: 202, body: { job } };
  }
  return notFound();
};
