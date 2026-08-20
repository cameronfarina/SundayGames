import { defaultLockTtlMs, type JobRecord } from "../jobs.js";
import { invalidPayloadError, missingHandlerError } from "./errorFactories.js";
import { PlatformJobOrchestratorError } from "./errors.js";
import { handlerContextFor } from "./handlerContext.js";
import type {
  PlatformJobHandlers,
  PlatformJobHeartbeatScheduler,
} from "./handlerContracts.js";
import {
  isDraftRoomExportJobPayload,
  isHistoricalImportParseJobPayload,
  isPricingRebuildJobPayload,
  isSimulationRunExecutionJobPayload,
  isSeasonSimulationExecutionJobPayload,
  platformJobTypeFrom,
} from "./payloadValidation.js";
import { platformJobTypes } from "./platformJobTypes.js";
import type { PlatformJobRepository } from "./repositoryContracts.js";
import type { PlatformJobResult } from "./results.js";

interface RunClaimedPlatformJobInput {
  repository: PlatformJobRepository;
  workerId: string;
  job: JobRecord;
  handlers: Partial<PlatformJobHandlers>;
  lockTtlMs?: number | undefined;
  heartbeatIntervalMs?: number | undefined;
  heartbeatScheduler: PlatformJobHeartbeatScheduler;
}

interface HandledPlatformJob {
  resultSummary: PlatformJobResult;
  latestJob: JobRecord;
}

export const runClaimedPlatformJob = async ({
  repository,
  workerId,
  job,
  handlers,
  lockTtlMs,
  heartbeatIntervalMs,
  heartbeatScheduler,
}: RunClaimedPlatformJobInput): Promise<HandledPlatformJob> => {
  let latestJob = job;
  let heartbeatError: unknown;
  const observeJob = (updatedJob: JobRecord): JobRecord => {
    latestJob = updatedJob;
    return updatedJob;
  };
  const type = platformJobTypeFrom(job.inputJson);
  const context = handlerContextFor(repository, job, workerId, observeJob);
  const intervalMs = heartbeatIntervalMs
    ?? Math.max(1_000, Math.floor((lockTtlMs ?? defaultLockTtlMs) / 2));
  const stopHeartbeat = intervalMs <= 0
    ? undefined
    : heartbeatScheduler(async () => {
      try {
        await context.heartbeat({ lockTtlMs });
      } catch (error) {
        heartbeatError = error;
      }
    }, intervalMs);

  try {
    let resultSummary: PlatformJobResult;

    switch (type) {
      case platformJobTypes.simulationRunExecution: {
        if (!isSimulationRunExecutionJobPayload(job.inputJson)) throw invalidPayloadError(type);
        const handler = handlers[type];
        if (handler === undefined) throw missingHandlerError(type);
        resultSummary = await handler(job.inputJson, context);
        break;
      }
      case platformJobTypes.seasonSimulationExecution: {
        if (!isSeasonSimulationExecutionJobPayload(job.inputJson)) throw invalidPayloadError(type);
        const handler = handlers[type];
        if (handler === undefined) throw missingHandlerError(type);
        resultSummary = await handler(job.inputJson, context);
        break;
      }
      case platformJobTypes.historicalImportParse: {
        if (!isHistoricalImportParseJobPayload(job.inputJson)) throw invalidPayloadError(type);
        const handler = handlers[type];
        if (handler === undefined) throw missingHandlerError(type);
        resultSummary = await handler(job.inputJson, context);
        break;
      }
      case platformJobTypes.pricingRebuild: {
        if (!isPricingRebuildJobPayload(job.inputJson)) throw invalidPayloadError(type);
        const handler = handlers[type];
        if (handler === undefined) throw missingHandlerError(type);
        resultSummary = await handler(job.inputJson, context);
        break;
      }
      case platformJobTypes.draftRoomExport: {
        if (!isDraftRoomExportJobPayload(job.inputJson)) throw invalidPayloadError(type);
        const handler = handlers[type];
        if (handler === undefined) throw missingHandlerError(type);
        resultSummary = await handler(job.inputJson, context);
        break;
      }
      case null:
        throw new PlatformJobOrchestratorError(
          "unknown_job_type",
          "Job input does not contain a known platform job type.",
        );
    }

    if (heartbeatError !== undefined) throw heartbeatError;
    return { resultSummary, latestJob };
  } finally {
    stopHeartbeat?.();
  }
};
