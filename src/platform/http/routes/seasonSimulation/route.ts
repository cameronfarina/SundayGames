import { SeasonSimulationError, maximumSeasonSimulationRunCount } from "../../../seasonSimulationEngine.js";
import { errorResponseFor } from "../../errors/errorResponse.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { headerValue, optionalBoolean, optionalNumber } from "../../request/values.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed, notFound } from "../../responses.js";
import { asyncTextStream, eventStreamChunk } from "../../stream.js";
import { enqueueSeasonSimulation } from "./execute.js";
import { observeQueuedSeasonSimulation } from "./observe.js";
import { prepareSeasonSimulation } from "./prepare.js";
import { readSeasonSimulation } from "./reads.js";
import { updateSeasonSimulationOutcome } from "./updateOutcome.js";

export const routeSeasonSimulations = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  services: PlatformHttpServices,
): Promise<PlatformHttpResponse> => {
  if (request.method === "GET" && request.segments.length === 2 &&
      request.segments[1] === "worker-status") {
    const health = await app.getSeasonSimulationQueueHealth({
      actorSessionToken: request.sessionToken,
      now: request.now,
    });
    return {
      status: 200,
      body: {
        workerAvailable: health.workerAvailable,
        workerLastSeenAt: health.workerLastSeenAt,
        simulationsAvailable: health.workerAvailable && health.producerEnabled,
      },
    };
  }
  if (request.method === "GET" && request.segments.length === 3 &&
      request.segments[2] === "observe") {
    const run = await app.getSimulationRun({
      actorSessionToken: request.sessionToken,
      runId: request.segments[1] ?? "",
      now: request.now,
    });
    const jobId = typeof request.query.jobId === "string" ? request.query.jobId : "";
    const queued = { historyId: run.id, jobId, runCount: run.request.count };
    return {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
      body: asyncTextStream(async emit => {
        try {
          const result = await observeQueuedSeasonSimulation(
            app,
            request,
            queued,
            progress => emit(eventStreamChunk("progress", progress)),
          );
          if (result !== undefined) {
            emit(eventStreamChunk("status" in result ? "pending" : "result", result));
          }
        } catch (error) {
          emit(eventStreamChunk("error", errorResponseFor(error).body));
        }
      }),
    };
  }
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
  if (request.segments.length !== 1 || request.method !== "POST") {
    return request.segments.length === 1 ? methodNotAllowed() : notFound();
  }
  const runCount = optionalNumber(request.body.count) ?? Number.NaN;
  if (!Number.isInteger(runCount) || runCount < 1 || runCount > maximumSeasonSimulationRunCount) {
    throw new SeasonSimulationError(
      "invalid_run_count",
      `Simulation run count must be a whole number from 1 through ${maximumSeasonSimulationRunCount}.`,
    );
  }
  const prepared = await prepareSeasonSimulation(app, request, services, runCount);
  if ("status" in prepared) return prepared;
  const queueHealth = await app.getSeasonSimulationQueueHealth({
    actorSessionToken: request.sessionToken,
    now: request.now,
  });
  if (!queueHealth.workerAvailable || !queueHealth.producerEnabled) {
    throw new SeasonSimulationError(
      "simulation_worker_unavailable",
      "Season simulations are temporarily unavailable. Try again after the worker resumes.",
    );
  }
  const queued = await enqueueSeasonSimulation(app, request, prepared);
  const acceptsEventStream = (headerValue(request.headers, "accept") ?? "")
    .toLowerCase().includes("text/event-stream");
  if (acceptsEventStream) {
    return {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
      body: asyncTextStream(async emit => {
        try {
          emit(eventStreamChunk("queued", {
            historyId: queued.historyId,
            jobId: queued.jobId,
            status: "queued",
          }));
          const result = await observeQueuedSeasonSimulation(
            app,
            request,
            queued,
            progress => emit(eventStreamChunk("progress", progress)),
          );
          if (result !== undefined) {
            emit(eventStreamChunk("status" in result ? "pending" : "result", result));
          }
        } catch (error) {
          emit(eventStreamChunk("error", errorResponseFor(error).body));
        }
      }),
    };
  }
  return {
    status: 202,
    body: {
      historyId: queued.historyId,
      jobId: queued.jobId,
      status: "queued",
    },
  };
};
