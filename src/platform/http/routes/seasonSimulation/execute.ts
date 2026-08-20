import { summarizeSeasonSimulation } from "../../../seasonSimulationHttpContract.js";
import type { PlatformApp } from "../../contracts.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import type { PreparedSeasonSimulation } from "./prepare.js";

export interface QueuedSeasonSimulation {
  historyId: string;
  jobId: string;
  runCount: number;
}

export const enqueueSeasonSimulation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  prepared: PreparedSeasonSimulation,
): Promise<QueuedSeasonSimulation> => {
  const createdAt = request.now ?? new Date();
  const admitted = await app.admitSeasonSimulationRunExecutionJob({
    actorSessionToken: request.sessionToken,
    leagueId: prepared.leagueId,
    seasonId: prepared.seasonId,
    ownerId: prepared.ownerId,
    teamId: prepared.teamId,
    count: prepared.runCount,
    seedPrefix: prepared.seedPrefix,
    idempotencyKey: `season-simulation:${prepared.requestId}`,
    simulationInput: prepared.input,
    strategyText: prepared.strategyInput,
    ...(prepared.note === undefined ? {} : { note: prepared.note }),
    now: createdAt,
  });
  return {
    historyId: admitted.run.id,
    jobId: admitted.job.id,
    runCount: prepared.runCount,
  };
};

export const completedSeasonSimulationResponse = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  queued: QueuedSeasonSimulation,
) => {
  const run = await app.getSimulationRun({
    actorSessionToken: request.sessionToken,
    runId: queued.historyId,
    now: request.now,
  });
  const result = run.result;
  const simulation = result?.seasonSimulation;
  if (run.status !== "completed" || result === undefined || simulation === undefined) {
    throw new Error(`Season simulation run ${queued.historyId} completed without a result.`);
  }
  return {
    historyId: run.id,
    summary: summarizeSeasonSimulation(simulation, result.favoriteRunNumbers),
    ...(result.note === undefined ? {} : { note: result.note }),
  };
};
