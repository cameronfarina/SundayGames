import {
  jobHistoryPageFor,
  maximumRetainedTerminalJobsPerUser,
  normalizedJobHistoryLimit,
  parseJobHistoryCursor,
  type JobHistoryPage,
  type ListJobsForUserInput,
} from "../jobHistory.js";
import type { JobRecord } from "./contracts.js";
import { JobError } from "./errors.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { isTerminalJob } from "./status.js";

const byNewestCreation = (left: JobRecord, right: JobRecord): number => {
  const createdAtOrder = right.createdAt.getTime() - left.createdAt.getTime();

  return createdAtOrder === 0 ? right.id.localeCompare(left.id) : createdAtOrder;
};

export const pruneTerminalHistory = (store: InMemoryJobStore, userId: string): void => {
  const terminalJobs = store.values()
    .filter(job => job.userId === userId && isTerminalJob(job))
    .sort(byNewestCreation);

  for (const job of terminalJobs.slice(maximumRetainedTerminalJobsPerUser)) {
    store.remove(job);
  }
};

export const listJobsForUser = (store: InMemoryJobStore, userId: string): JobRecord[] =>
  store.values().filter(job => job.userId === userId);

export const listJobPageForUser = (
  store: InMemoryJobStore,
  input: ListJobsForUserInput,
): JobHistoryPage => {
  const cursor = input.cursor === undefined ? undefined : parseJobHistoryCursor(input.cursor);
  if (cursor === null) {
    throw new JobError("invalid_job_cursor", "Job history cursor is invalid.");
  }

  const records = store.values()
    .filter(job => job.userId === input.userId)
    .filter(job => cursor === undefined ||
      job.createdAt.getTime() < cursor.createdAt.getTime() ||
      (job.createdAt.getTime() === cursor.createdAt.getTime() && job.id < cursor.id))
    .sort(byNewestCreation);
  const limit = normalizedJobHistoryLimit(input.limit);

  return jobHistoryPageFor(records.slice(0, limit + 1), limit);
};
