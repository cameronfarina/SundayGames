import type { SimulationRun } from "../../simulations.js";
import type { ExecutePlatformSeasonSimulationRunForWorkerInput } from "../contracts/simulation.js";
import type { PlatformAppContext } from "../context.js";
import { cloneForRead } from "../shared.js";
import { requireSimulationRunForWorker } from "./simulationWorkerAccess.js";

export const createSeasonSimulationWorkerOperations = (context: PlatformAppContext) => ({
  executeSeasonSimulationRunForWorker: async (
    input: ExecutePlatformSeasonSimulationRunForWorkerInput,
  ): Promise<SimulationRun> => {
    const run = await requireSimulationRunForWorker(context, input);
    if (run.status === "completed" && run.result?.seasonSimulation !== undefined) {
      return cloneForRead(run);
    }
    const runner = context.seasonSimulationRunner;
    if (runner === undefined) throw new Error("Season simulation worker runner is unavailable.");
    const completedAt = input.now ?? new Date();
    await context.simulations.markRunning(run.id, completedAt);
    try {
      const simulation = await runner(input.simulationInput, {
        accountId: input.userId,
        onProgress: input.onProgress,
      });
      return cloneForRead(await context.simulations.complete(run.id, {
        runId: run.id,
        requestId: run.request.id,
        completedAt,
        runCount: run.request.count,
        seedPrefix: run.request.seedPrefix,
        hardLockCount: 0,
        softTargetCount: 0,
        forcedSales: [],
        summary: {
          runCount: run.request.count,
          scenarios: [],
          players: [],
          owners: [],
          ownerPlayerExposure: [],
        },
        seasonSimulation: simulation,
        strategyText: input.strategyText,
        ...(input.note === undefined ? {} : { note: input.note }),
      }, completedAt));
    } catch (error) {
      try {
        await context.simulations.markFailed(run.id, completedAt);
      } catch {
        // Preserve the runner failure while recording failure when possible.
      }
      throw error;
    }
  },
});
