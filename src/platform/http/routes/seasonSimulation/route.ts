import { SeasonSimulationError, maximumSeasonSimulationRunCount } from "../../../seasonSimulationEngine.js";
import { randomUUID } from "node:crypto";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { optionalBoolean, optionalNumber, optionalString } from "../../request/values.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed, notFound } from "../../responses.js";
import {
  completeSeasonSimulationLaunch,
  createSeasonSimulationLaunch,
  seasonSimulationLaunchBody,
} from "./execute.js";
import { prepareSeasonSimulation } from "./prepare.js";
import { readSeasonSimulation } from "./reads.js";
import { updateSeasonSimulationOutcome } from "./updateOutcome.js";
import { legacySimulationClientResponse } from "./legacyClient.js";

export const routeSeasonSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  const isRunRead = request.method === "GET"
    && request.segments.length === 4
    && request.segments[2] === "runs";
  if (request.method === "GET" && (request.segments.length <= 2 || isRunRead)) {
    return await readSeasonSimulation(app, request);
  }
  const isOutcomeUpdate = request.method === "PATCH"
    && request.segments.length === 4
    && request.segments[2] === "runs";
  if (isOutcomeUpdate) {
    return await updateSeasonSimulationOutcome(
      app,
      request,
      optionalBoolean(request.body.favorite),
    );
  }
  const isCompletion = request.method === "POST"
    && request.segments.length === 3
    && request.segments[2] === "complete";
  if (isCompletion) {
    return {
      status: 200,
      body: await completeSeasonSimulationLaunch(app, request, request.segments[1] ?? ""),
    };
  }
  const isCancellation = request.method === "DELETE" && request.segments.length === 2;
  if (isCancellation) {
    await app.cancelSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: request.segments[1] ?? "",
      now: request.now,
    });
    return { status: 204, body: undefined };
  }
  const isRequestCancellation = request.method === "DELETE" && request.segments.length === 3 &&
    request.segments[1] === "requests";
  if (isRequestCancellation) {
    const seasonId = optionalString(request.query.seasonId);
    if (seasonId === undefined) throw new SeasonSimulationError(
      "invalid_configuration",
      "Season ID is required to cancel a simulation launch.",
    );
    const run = await app.findSimulationLaunch({
      actorSessionToken: request.sessionToken,
      seasonId,
      requestId: request.segments[2] ?? "",
      now: request.now,
    });
    if (run !== null) await app.cancelSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: run.id,
      now: request.now,
    });
    return { status: 204, body: undefined };
  }
  if (request.segments.length !== 1 || request.method !== "POST") {
    return request.segments.length === 1 ? methodNotAllowed() : notFound();
  }
  const legacyClientResponse = legacySimulationClientResponse(request);
  if (legacyClientResponse !== null) return legacyClientResponse;
  const runCount = optionalNumber(request.body.count) ?? maximumSeasonSimulationRunCount;
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > maximumSeasonSimulationRunCount) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      `Simulation run count must be a whole number from 1 through ${maximumSeasonSimulationRunCount}.`,
    );
  }
  const requestId = optionalString(request.body.requestId) ?? randomUUID();
  const seasonId = optionalString(request.body.seasonId);
  if (seasonId !== undefined) {
    const existing = await app.findSimulationLaunch({
      actorSessionToken: request.sessionToken,
      seasonId,
      requestId,
      now: request.now,
    });
    if (existing !== null) return { status: 202, body: seasonSimulationLaunchBody(existing, requestId) };
  }
  const prepared = await prepareSeasonSimulation(app, request, services, runCount, requestId);
  if ("status" in prepared) return prepared;
  return {
    status: 202,
    body: await createSeasonSimulationLaunch(app, request, prepared, requestId),
  };
};
