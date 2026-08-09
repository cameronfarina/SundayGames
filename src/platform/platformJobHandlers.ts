import type { ExecutePlatformSimulationRunForWorkerInput } from "./platformApp.js";
import {
  platformJobTypes,
  type DraftRoomExportJobPayload,
  type DraftRoomExportJobResult,
  type HistoricalImportParseJobPayload,
  type HistoricalImportParseJobResult,
  type PlatformJobHandler,
  type PlatformJobHandlerContext,
  type PlatformJobHandlers,
  type PlatformJobPayload,
  type PlatformJobResult,
  type PlatformJobType,
  type PricingRebuildJobPayload,
  type PricingRebuildJobResult,
  type SimulationRunExecutionJobPayload,
  type SimulationRunExecutionJobResult,
} from "./platformJobOrchestrator.js";
import type { SimulationRun } from "./simulations.js";

export interface SimulationRunExecutionApp {
  executeSimulationRunForWorker(input: ExecutePlatformSimulationRunForWorkerInput): Promise<SimulationRun>;
}

export interface CreateSimulationRunExecutionHandlerInput {
  app: SimulationRunExecutionApp;
  persist?: (() => void | Promise<void>) | undefined;
}

export class UnsupportedPlatformJobHandlerError extends Error {
  readonly jobType: PlatformJobType;

  constructor(jobType: PlatformJobType) {
    super(`Platform job handler for ${jobType} is not implemented yet.`);
    this.name = "UnsupportedPlatformJobHandlerError";
    this.jobType = jobType;
  }
}

export const createSimulationRunExecutionHandler = ({
  app,
  persist,
}: CreateSimulationRunExecutionHandlerInput): PlatformJobHandler<
  SimulationRunExecutionJobPayload,
  SimulationRunExecutionJobResult
> =>
  async (payload, context) => {
    context.updateProgress({
      completed: 0,
      total: payload.runCount,
      message: `Running simulation run 0/${payload.runCount}`,
    });

    const completedRun = await app.executeSimulationRunForWorker({
      runId: payload.simulationRunId,
      userId: context.job.userId,
      leagueId: context.job.leagueId,
      seasonId: context.job.seasonId,
      now: context.job.lockedAt ?? context.job.startedAt,
    });
    const result = completedRun.result;

    if (result === undefined) {
      throw new Error(`Simulation run ${payload.simulationRunId} completed without a result summary.`);
    }
    await persist?.();

    const runCount = result.runCount;
    const completedRunCount = result.summary.runCount;

    context.updateProgress({
      completed: completedRunCount,
      total: runCount,
      message: `Completed simulation run ${completedRunCount}/${runCount}`,
    });

    return {
      type: platformJobTypes.simulationRunExecution,
      simulationRunId: completedRun.id,
      runCount,
      completedRunCount,
    };
  };

const unsupportedPlatformJobHandler = <
  Payload extends PlatformJobPayload,
  Result extends PlatformJobResult,
>(
  jobType: PlatformJobType,
): PlatformJobHandler<Payload, Result> =>
  () => {
    throw new UnsupportedPlatformJobHandlerError(jobType);
  };

export const createNoopPlatformJobHandlers = (): PlatformJobHandlers => ({
  [platformJobTypes.simulationRunExecution]: unsupportedPlatformJobHandler<
    SimulationRunExecutionJobPayload,
    SimulationRunExecutionJobResult
  >(platformJobTypes.simulationRunExecution),
  [platformJobTypes.historicalImportParse]: unsupportedPlatformJobHandler<
    HistoricalImportParseJobPayload,
    HistoricalImportParseJobResult
  >(platformJobTypes.historicalImportParse),
  [platformJobTypes.pricingRebuild]: unsupportedPlatformJobHandler<
    PricingRebuildJobPayload,
    PricingRebuildJobResult
  >(platformJobTypes.pricingRebuild),
  [platformJobTypes.draftRoomExport]: unsupportedPlatformJobHandler<
    DraftRoomExportJobPayload,
    DraftRoomExportJobResult
  >(platformJobTypes.draftRoomExport),
});

export const createPlatformJobHandlers = (
  input: CreateSimulationRunExecutionHandlerInput,
): PlatformJobHandlers => ({
  ...createNoopPlatformJobHandlers(),
  [platformJobTypes.simulationRunExecution]: createSimulationRunExecutionHandler(input),
});
