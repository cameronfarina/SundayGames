import {
  defaultLockTtlMs,
  type ClaimNextJobInput,
  type JobRecord,
} from "../jobs.js";
import { jobFromRow } from "./jobRow.js";
import { claimNextJobSql } from "./sql.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const claimNextJob = async (
  context: JobQueueContext,
  input: ClaimNextJobInput,
): Promise<JobRecord | null> => {
  const now = input.now ?? new Date();
  const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
  const lockExpiresAt = new Date(now.getTime() + lockTtlMs);

  return await context.client.transaction(async transactionClient => {
    const result = await transactionClient.query<JobRow>(claimNextJobSql, [
      now,
      input.workerId,
      lockExpiresAt,
      input.kinds === undefined ? null : [...input.kinds],
    ]);
    const row = firstRow(result);
    return row === undefined ? null : jobFromRow(row);
  });
};
