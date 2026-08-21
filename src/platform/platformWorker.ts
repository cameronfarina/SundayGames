import type { JobKind, JobRecord } from "./jobs.js";
import {
  dispatchNextPlatformJob,
  type DispatchNextPlatformJobInput,
  type PlatformJobHeartbeatScheduler,
  type PlatformJobHandlers,
  type PlatformJobRepository,
} from "./platformJobOrchestrator.js";

export interface RunPlatformWorkerOnceInput {
  repository: PlatformJobRepository;
  workerId: string;
  handlers: Partial<PlatformJobHandlers>;
  now?: Date | undefined;
  lockTtlMs?: number | undefined;
  jobKinds?: readonly JobKind[] | undefined;
  heartbeatIntervalMs?: number | undefined;
  heartbeatScheduler?: PlatformJobHeartbeatScheduler | undefined;
}

export interface PlatformWorkerLoopStats {
  iterations: number;
  dispatchedJobs: number;
  idlePolls: number;
  errors: number;
}

export interface RunPlatformWorkerLoopInput extends RunPlatformWorkerOnceInput {
  pollIntervalMs?: number | undefined;
  maxIterations?: number | undefined;
  abortSignal?: AbortSignal | undefined;
  sleep?: ((milliseconds: number) => Promise<void>) | undefined;
  onError?: ((error: unknown) => void | Promise<void>) | undefined;
}

const defaultPollIntervalMs = 1_000;

const sleepFor = async (milliseconds: number): Promise<void> => {
  await new Promise<void>(resolve => {
    setTimeout(resolve, milliseconds);
  });
};

export const runPlatformWorkerOnce = async ({
  repository,
  workerId,
  handlers,
  now,
  lockTtlMs,
  jobKinds,
  heartbeatIntervalMs,
  heartbeatScheduler,
}: RunPlatformWorkerOnceInput): Promise<JobRecord | null> => {
  const dispatchInput: DispatchNextPlatformJobInput = {
    repository,
    workerId,
    handlers,
    ...(now === undefined ? {} : { now }),
    ...(lockTtlMs === undefined ? {} : { lockTtlMs }),
    ...(jobKinds === undefined ? {} : { jobKinds }),
    ...(heartbeatIntervalMs === undefined ? {} : { heartbeatIntervalMs }),
    ...(heartbeatScheduler === undefined ? {} : { heartbeatScheduler }),
  };

  return await dispatchNextPlatformJob(dispatchInput);
};

export const runPlatformWorkerLoop = async ({
  repository,
  workerId,
  handlers,
  now,
  lockTtlMs,
  jobKinds,
  heartbeatIntervalMs,
  heartbeatScheduler,
  pollIntervalMs = defaultPollIntervalMs,
  maxIterations,
  abortSignal,
  sleep = sleepFor,
  onError,
}: RunPlatformWorkerLoopInput): Promise<PlatformWorkerLoopStats> => {
  const stats: PlatformWorkerLoopStats = {
    iterations: 0,
    dispatchedJobs: 0,
    idlePolls: 0,
    errors: 0,
  };

  while (abortSignal?.aborted !== true) {
    if (maxIterations !== undefined && stats.iterations >= maxIterations) break;
    stats.iterations += 1;

    try {
      const job = await runPlatformWorkerOnce({
        repository,
        workerId,
        handlers,
        ...(now === undefined ? {} : { now }),
        ...(lockTtlMs === undefined ? {} : { lockTtlMs }),
        ...(jobKinds === undefined ? {} : { jobKinds }),
        ...(heartbeatIntervalMs === undefined ? {} : { heartbeatIntervalMs }),
        ...(heartbeatScheduler === undefined ? {} : { heartbeatScheduler }),
      });

      if (job === null) {
        stats.idlePolls += 1;
        await sleep(pollIntervalMs);
      } else {
        stats.dispatchedJobs += 1;
      }
    } catch (error) {
      stats.errors += 1;
      if (onError === undefined) throw error;

      await onError(error);
      await sleep(pollIntervalMs);
    }
  }

  return stats;
};
