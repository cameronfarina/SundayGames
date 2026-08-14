import { SeasonSimulationError, maximumSeasonSimulationRunCount } from "../../../seasonSimulationEngine.js";
import { errorResponseFor } from "../../errors/errorResponse.js";
import type { PlatformApp, PlatformHttpResponse, PlatformHttpServices } from "../../contracts.js";
import { headerValue, optionalNumber } from "../../request/values.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { methodNotAllowed, notFound } from "../../responses.js";
import { asyncTextStream, eventStreamChunk } from "../../stream.js";
import { executeAndStoreSeasonSimulation } from "./execute.js";
import { prepareSeasonSimulation } from "./prepare.js";
import { readSeasonSimulation } from "./reads.js";

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
          const result = await executeAndStoreSeasonSimulation(
            app,
            request,
            services,
            prepared,
            progress => emit(eventStreamChunk("progress", progress)),
          );
          emit(eventStreamChunk("result", result));
        } catch (error) {
          emit(eventStreamChunk("error", errorResponseFor(error).body));
        }
      }),
    };
  }
  return { status: 200, body: await executeAndStoreSeasonSimulation(app, request, services, prepared) };
};
