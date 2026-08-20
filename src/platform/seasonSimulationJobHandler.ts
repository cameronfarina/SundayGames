import type { CreateSimulationRunExecutionHandlerInput } from "./platformJobHandlers.js";
import {
  platformJobTypes,
  type PlatformJobHandler,
  type SeasonSimulationExecutionJobPayload,
  type SeasonSimulationExecutionJobResult,
} from "./platformJobOrchestrator.js";
import { decodeSeasonSimulationExecutionJobInput } from "./seasonSimulationJobPayload.js";

export const createSeasonSimulationExecutionHandler = ({
  app,
}: CreateSimulationRunExecutionHandlerInput): PlatformJobHandler<
SeasonSimulationExecutionJobPayload,
SeasonSimulationExecutionJobResult
> => async (payload, context) => {
  await context.updateProgress({
    completed: 0,
    total: payload.runCount,
    message: `Running simulation run 0/${payload.runCount}`,
  });
  let progressUpdates = Promise.resolve();
  let progressError: unknown;
  const completedRun = await app.executeSeasonSimulationRunForWorker({
    runId: payload.simulationRunId,
    userId: context.job.userId,
    leagueId: context.job.leagueId,
    seasonId: context.job.seasonId,
    now: context.job.lockedAt ?? context.job.startedAt,
    simulationInput: decodeSeasonSimulationExecutionJobInput(payload.seasonSimulation),
    strategyText: payload.seasonSimulation.strategyText,
    ...(payload.seasonSimulation.note === undefined ? {} : { note: payload.seasonSimulation.note }),
    onProgress: progress => {
      progressUpdates = progressUpdates
        .then(async () => await context.updateProgress({
          ...progress,
          message: `Running simulation run ${progress.completed}/${progress.total}`,
        }))
        .then(() => undefined)
        .catch(error => { progressError = error; });
    },
  });
  await progressUpdates;
  if (progressError !== undefined) throw progressError;
  const result = completedRun.result;
  if (result === undefined) {
    throw new Error(`Simulation run ${payload.simulationRunId} completed without a result summary.`);
  }
  await context.updateProgress({
    completed: result.summary.runCount,
    total: result.runCount,
    message: `Completed simulation run ${result.summary.runCount}/${result.runCount}`,
  });
  return {
    type: platformJobTypes.seasonSimulationExecution,
    simulationRunId: completedRun.id,
    runCount: result.runCount,
    completedRunCount: result.summary.runCount,
  };
};
