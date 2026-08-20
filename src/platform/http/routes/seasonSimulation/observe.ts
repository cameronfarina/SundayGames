import type { JobProgress } from "../../../jobs.js";
import { SeasonSimulationError, type SeasonSimulationProgress } from "../../../seasonSimulationEngine.js";
import type { PlatformApp } from "../../contracts.js";
import { simulationRunIdForJob } from "../../../app/shared.js";
import type { ParsedPlatformHttpRequest } from "../../request/parsedRequest.js";
import {
  completedSeasonSimulationResponse,
  type QueuedSeasonSimulation,
} from "./execute.js";

const initialPollIntervalMs = 500;
const maximumPollIntervalMs = 4_000;
const observationWindowMs = 25_000;

const sleepUntilNextPoll = async (
  signal: AbortSignal | undefined,
  pollIntervalMs: number,
): Promise<boolean> => {
  if (signal?.aborted === true) return false;
  return await new Promise(resolve => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve(true);
    }, pollIntervalMs);
    const abort = (): void => {
      clearTimeout(timeout);
      resolve(false);
    };
    signal?.addEventListener("abort", abort, { once: true });
  });
};

const publicProgress = (
  progress: JobProgress,
  runCount: number,
  completed: boolean,
): SeasonSimulationProgress => ({
  completed: completed ? runCount : Math.min(progress.completed, runCount),
  total: runCount,
});

export const observeQueuedSeasonSimulation = async (
  app: PlatformApp,
  request: ParsedPlatformHttpRequest,
  queued: QueuedSeasonSimulation,
  onProgress: (progress: SeasonSimulationProgress) => void,
) => {
  let lastProgress = "";
  let pollIntervalMs = initialPollIntervalMs;
  const observationStartedAt = Date.now();
  for (;;) {
    if (request.signal?.aborted === true) return undefined;
    const job = await app.getJob({
      actorSessionToken: request.sessionToken,
      jobId: queued.jobId,
      now: request.now,
    });
    if (simulationRunIdForJob(job) !== queued.historyId) {
      throw new SeasonSimulationError(
        "invalid_configuration",
        "Simulation observation handle does not match its durable run.",
      );
    }
    const progress = publicProgress(job.progress, queued.runCount, job.status === "completed");
    const progressKey = `${progress.completed}/${progress.total}`;
    if (progressKey !== lastProgress) {
      onProgress(progress);
      lastProgress = progressKey;
    }
    if (job.status === "completed") {
      return await completedSeasonSimulationResponse(app, request, queued);
    }
    if (job.status === "failed") {
      throw new SeasonSimulationError(
        "simulation_failed",
        job.sanitizedError?.message ?? "Season simulation failed in the background worker.",
      );
    }
    if (job.status === "canceled") {
      throw new SeasonSimulationError("simulation_canceled", "Season simulation was canceled.");
    }
    if (Date.now() - observationStartedAt >= observationWindowMs) {
      const status: "pending" = "pending";
      return { historyId: queued.historyId, jobId: queued.jobId, status };
    }
    if (!await sleepUntilNextPoll(request.signal, pollIntervalMs)) return undefined;
    pollIntervalMs = Math.min(pollIntervalMs * 2, maximumPollIntervalMs);
  }
};
