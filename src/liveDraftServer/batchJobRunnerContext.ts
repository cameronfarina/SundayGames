import type { CreateLiveDraftServerOptions, MockBatchJob } from "./contracts.js";
import type { LiveDraftData } from "./runtimeContracts.js";

export interface RunJobContext {
  job: MockBatchJob;
  runsPerScenario: number;
  seedPrefix: string;
  options: CreateLiveDraftServerOptions;
  data: LiveDraftData;
  now: () => Date;
}

export const yieldToEventLoop = async (): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, 0));

export const updateProgress = (
  job: MockBatchJob,
  completedRuns: number,
  now: () => Date,
): void => {
  job.completedRuns = completedRuns;
  job.percent = job.totalRuns <= 0 ? 100 : Math.round((completedRuns / job.totalRuns) * 100);
  job.updatedAt = now().toISOString();
};
