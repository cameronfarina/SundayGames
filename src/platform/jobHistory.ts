import type { JobProgress, JobRecord, JobStatus, JobKind } from "./jobs.js";

export const defaultJobHistoryPageSize = 25;
export const maximumJobHistoryPageSize = 50;
export const maximumRetainedTerminalJobsPerUser = 200;

export interface JobHistoryCursor {
  createdAt: Date;
  id: string;
}

export interface ListJobsForUserInput {
  userId: string;
  cursor?: string | undefined;
  limit?: number | undefined;
}

export interface JobSummary {
  id: string;
  leagueId: string;
  seasonId: string;
  kind: JobKind;
  status: JobStatus;
  progress: JobProgress;
  attempts: number;
  maxAttempts: number;
  cancellationRequestedAt: Date | undefined;
  startedAt: Date | undefined;
  finishedAt: Date | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export interface JobHistoryPage {
  jobs: readonly JobSummary[];
  nextCursor: string | undefined;
}

export const normalizedJobHistoryLimit = (limit: number | undefined): number => {
  if (limit === undefined) return defaultJobHistoryPageSize;
  if (!Number.isSafeInteger(limit) || limit < 1) return defaultJobHistoryPageSize;

  return Math.min(limit, maximumJobHistoryPageSize);
};

export const jobHistoryCursorFor = (job: Pick<JobRecord, "createdAt" | "id">): string =>
  Buffer.from(`${job.createdAt.toISOString()}\0${job.id}`).toString("base64url");

export const parseJobHistoryCursor = (cursor: string): JobHistoryCursor | null => {
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const separator = decoded.indexOf("\0");
  if (separator < 1 || separator === decoded.length - 1) return null;
  const createdAt = new Date(decoded.slice(0, separator));
  if (Number.isNaN(createdAt.getTime())) return null;

  return { createdAt, id: decoded.slice(separator + 1) };
};

export const jobSummaryFor = (job: JobRecord): JobSummary => ({
  id: job.id,
  leagueId: job.leagueId,
  seasonId: job.seasonId,
  kind: job.kind,
  status: job.status,
  progress: { ...job.progress },
  attempts: job.attempts,
  maxAttempts: job.maxAttempts,
  cancellationRequestedAt: job.cancellationRequestedAt,
  startedAt: job.startedAt,
  finishedAt: job.finishedAt,
  createdAt: job.createdAt,
  updatedAt: job.updatedAt,
});

export const jobHistoryPageFor = (
  records: readonly JobRecord[],
  limit: number,
): JobHistoryPage => {
  const visible = records.slice(0, limit);
  const last = visible.at(-1);

  return {
    jobs: visible.map(jobSummaryFor),
    nextCursor: records.length > limit && last !== undefined
      ? jobHistoryCursorFor(last)
      : undefined,
  };
};
