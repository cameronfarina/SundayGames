import type { JobProgress } from "../jobs.js";

export const queuedProgress: JobProgress = {
  completed: 0,
  total: 1,
  message: "Queued",
};

export const completedProgress: JobProgress = {
  completed: 1,
  total: 1,
  message: "Completed",
};

export const cancelStatusRaceRetryLimit = 3;
