import type { JobRecord, JobStatus } from "./contracts.js";

const terminalJobStatuses = new Set<JobStatus>(["completed", "failed", "canceled"]);

export const isTerminalJob = (job: JobRecord): boolean => terminalJobStatuses.has(job.status);
