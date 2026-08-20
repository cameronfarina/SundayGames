import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueueSeasonSimulationExecutionJobInput } from "./enqueueContracts.js";
import type { SeasonSimulationExecutionJobPayload } from "./payloads.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import { platformJobTypes } from "./platformJobTypes.js";
import { submitPlatformJob } from "./submitPlatformJob.js";

export function enqueueSeasonSimulationExecutionJob(
  input: EnqueueSeasonSimulationExecutionJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueSeasonSimulationExecutionJob(
  input: EnqueueSeasonSimulationExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueSeasonSimulationExecutionJob(
  input: EnqueueSeasonSimulationExecutionJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: SeasonSimulationExecutionJobPayload = {
    type: platformJobTypes.seasonSimulationExecution,
    simulationRunId: input.simulationRunId,
    runCount: input.runCount,
    seasonSimulation: input.seasonSimulation,
    ...(input.seedPrefix === undefined ? {} : { seedPrefix: input.seedPrefix }),
  };
  return submitPlatformJob({
    ...input,
    idempotencyKey: undefined,
    payload,
    defaultIdempotencyKeyParts: [input.simulationRunId],
  });
}
