import type { JobRecord } from "./contracts.js";

export const canAccessJob = (userId: string, job: JobRecord): boolean => job.userId === userId;
