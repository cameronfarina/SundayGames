import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueueSimulationRunExecutionJobInput } from "./enqueueContracts.js";
import type { SimulationRunExecutionJobPayload } from "./payloads.js";
import { platformJobTypes } from "./platformJobTypes.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import { submitPlatformJob } from "./submitPlatformJob.js";

export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueSimulationRunExecutionJob(
  input: EnqueueSimulationRunExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: SimulationRunExecutionJobPayload = {
    type: platformJobTypes.simulationRunExecution,
    simulationRunId: input.simulationRunId,
    runCount: input.runCount,
  };
  if (input.modelRunId !== undefined) payload.modelRunId = input.modelRunId;
  if (input.keeperScenarioId !== undefined) payload.keeperScenarioId = input.keeperScenarioId;
  if (input.seedPrefix !== undefined) payload.seedPrefix = input.seedPrefix;
  if (input.strategyKey !== undefined) payload.strategyKey = input.strategyKey;
  return submitPlatformJob({
    ...input,
    idempotencyKey: undefined,
    payload,
    defaultIdempotencyKeyParts: [input.simulationRunId],
  });
}
