import { runAuthenticatedHttpBurst, type QueuedLoadJob } from "./httpBurst.js";
import { elapsedMeasurement, type LoadMeasurement } from "./metrics.js";

export interface WaitForQueuedLoadJobsOptions {
  readonly pollIntervalMs?: number | undefined;
  readonly timeoutMs?: number | undefined;
}

interface ResolvedWaitForQueuedLoadJobsOptions {
  readonly pollIntervalMs: number;
  readonly timeoutMs: number;
}

const sleep = async (durationMs: number): Promise<void> => {
  await new Promise<void>(resolve => setTimeout(resolve, durationMs));
};

const waitForJob = async (
  baseUrl: URL,
  job: QueuedLoadJob,
  options: ResolvedWaitForQueuedLoadJobsOptions,
): Promise<LoadMeasurement> => {
  const startedAt = performance.now();
  while (performance.now() - startedAt < options.timeoutMs) {
    const [read] = await runAuthenticatedHttpBurst(baseUrl, [{
      jobId: job.jobId,
      method: "GET",
      path: `/jobs/${encodeURIComponent(job.jobId)}`,
      responseKind: "job",
      sessionToken: job.sessionToken,
    }]);
    if (read === undefined) return elapsedMeasurement("missing_job_response", startedAt);
    if (!read.ok) return elapsedMeasurement(read.diagnostic, startedAt, read.status);
    if (read.jobStatus === "completed") {
      return elapsedMeasurement("ok", startedAt, read.status);
    }
    if (read.jobStatus === "failed" || read.jobStatus === "canceled") {
      return elapsedMeasurement(`job_${read.jobStatus}`, startedAt, read.status);
    }
    await sleep(options.pollIntervalMs);
  }
  return elapsedMeasurement("job_timeout", startedAt);
};

export const waitForQueuedLoadJobs = async (
  baseUrl: URL,
  jobs: readonly QueuedLoadJob[],
  options: WaitForQueuedLoadJobsOptions = {},
): Promise<readonly LoadMeasurement[]> => {
  const resolvedOptions = {
    pollIntervalMs: options.pollIntervalMs ?? 1_000,
    timeoutMs: options.timeoutMs ?? 180_000,
  };
  return await Promise.all(jobs.map(async job => await waitForJob(baseUrl, job, resolvedOptions)));
};
