import type { MockBatch } from "../../modeling/mockBatch.js";
import { forcedSalesForSimulationRequest } from "./forcedSales.js";
import type { ExecuteSimulationRunInput } from "./repositoryContracts.js";
import type { SimulationResult, SimulationRun } from "./runContracts.js";

export const executeSimulationRun = async ({
  repository,
  runId,
  runner,
  now,
}: ExecuteSimulationRunInput): Promise<SimulationRun> => {
  const runAt = now ?? new Date();
  const existingRun = await repository.find(runId);
  if (existingRun.status === "completed" && existingRun.result !== undefined) return existingRun;
  if (existingRun.status === "canceled") return existingRun;

  const run = await repository.markRunning(runId, runAt);
  const forcedSales = forcedSalesForSimulationRequest(run.request);
  let batch: MockBatch;
  try {
    batch = await runner({
      runsPerScenario: run.request.count,
      seedPrefix: run.request.seedPrefix,
      forcedSales,
      hardLocks: run.request.strategy.hardLocks,
      softTargets: run.request.strategy.softTargets,
    });
  } catch (error) {
    await repository.markFailed(run.id);
    throw error;
  }

  const result: SimulationResult = {
    runId: run.id,
    requestId: run.request.id,
    completedAt: runAt,
    runCount: batch.summary.runCount,
    seedPrefix: run.request.seedPrefix,
    hardLockCount: run.request.strategy.hardLocks.length,
    softTargetCount: run.request.strategy.softTargets.length,
    forcedSales,
    summary: batch.summary,
  };
  return await repository.complete(run.id, result);
};
