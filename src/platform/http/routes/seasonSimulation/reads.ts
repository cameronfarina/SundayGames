import { simulationRunForNumber, summarizeSeasonSimulation } from "../../../seasonSimulationHttpContract.js";
import type { PlatformApp, PlatformHttpResponse } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import { stringValue } from "../../request/values.js";
import { notFound } from "../../responses.js";

export const readSeasonSimulation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
): Promise<PlatformHttpResponse> => {
  if (request.segments.length === 1) {
    const seasonId = stringValue(request.query.seasonId);
    const runs = await app.listSimulationRuns({
      actorSessionToken: request.sessionToken,
      seasonId,
      historyLimit: 25,
      now: request.now,
    });
    return {
      status: 200,
      body: {
        history: runs.flatMap(run => {
          const result = run.result;
          if (run.request.seasonId !== seasonId || result?.seasonSimulation === undefined) return [];
          return [{
            id: run.id,
            createdAt: run.createdAt,
            completedAt: run.completedAt,
            note: result.note,
            strategyText: result.strategyText,
            simulation: {
              draftFormat: result.seasonSimulation.draftFormat,
              runCount: result.seasonSimulation.runCount,
              completedCount: result.seasonSimulation.completedCount,
              strategy: result.seasonSimulation.strategy,
              targetOutcomes: result.seasonSimulation.targetOutcomes,
              targetOutcome: result.seasonSimulation.targetOutcome,
              outcomes: summarizeSeasonSimulation(
                result.seasonSimulation,
                result.favoriteRunNumbers,
              ).outcomes,
            },
          }];
        }),
      },
    };
  }
  const run = await app.getSimulationRun({
    actorSessionToken: request.sessionToken,
    runId: request.segments[1] ?? "",
    now: request.now,
  });
  if (run.result?.seasonSimulation === undefined) return notFound();
  if (request.segments.length === 2) {
    return {
      status: 200,
      body: {
        summary: summarizeSeasonSimulation(
          run.result.seasonSimulation,
          run.result.favoriteRunNumbers,
        ),
        note: run.result.note,
        historyId: run.id,
      },
    };
  }
  const runNumber = Number(request.segments[3]);
  const simulationRun = Number.isInteger(runNumber) && runNumber > 0
    ? simulationRunForNumber(run.result.seasonSimulation, runNumber) : undefined;
  return simulationRun === undefined
    ? notFound()
    : { status: 200, body: { historyId: run.id, run: simulationRun } };
};
