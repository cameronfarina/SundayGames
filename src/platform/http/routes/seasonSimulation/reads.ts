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
        history: runs
          .filter(run => run.request.seasonId === seasonId && run.result?.seasonSimulation !== undefined)
          .map(run => ({
            id: run.id,
            createdAt: run.createdAt,
            completedAt: run.completedAt,
            note: run.result?.note,
            strategyText: run.result?.strategyText,
            simulation: {
              draftFormat: run.result?.seasonSimulation?.draftFormat,
              runCount: run.result?.seasonSimulation?.runCount,
              completedCount: run.result?.seasonSimulation?.completedCount,
              strategy: run.result?.seasonSimulation?.strategy,
              targetOutcomes: run.result?.seasonSimulation?.targetOutcomes,
              targetOutcome: run.result?.seasonSimulation?.targetOutcome,
            },
          })),
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
        summary: summarizeSeasonSimulation(run.result.seasonSimulation),
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
