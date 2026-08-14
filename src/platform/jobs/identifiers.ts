import { randomBytes } from "node:crypto";

const jobIdBytes = 16;

export const createJobId = (): string => `job_${randomBytes(jobIdBytes).toString("base64url")}`;

export const jobRerunIdempotencyKeyFor = (
  jobId: string,
  rerunIdempotencyKey: string,
): string => `rerun:${jobId}:${rerunIdempotencyKey}`;

export const idempotencyIndexKey = (
  userId: string,
  leagueId: string,
  seasonId: string,
  idempotencyKey: string,
): string => [userId, leagueId, seasonId, idempotencyKey].join("\0");
