import {
  JobError,
  createJobId,
  defaultMaxAttempts,
  hashJobInput,
  type JobRecord,
  type SubmitJobInput,
} from "../jobs.js";
import type { PostgresQueryClient } from "../postgresPlatformStore.js";
import { queuedProgress } from "./constants.js";
import { jobFromRow } from "./jobRow.js";
import { jsonbParameter } from "./json.js";
import { findByIdempotencyKey } from "./lookups.js";
import { pruneTerminalHistory } from "./prune.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

export const submitJobWithClient = async (
  context: JobQueueContext,
  input: SubmitJobInput,
  client: PostgresQueryClient,
): Promise<JobRecord> => {
  const now = input.now ?? new Date();
  const inputHash = hashJobInput(input.inputJson);
  const result = await client.query<JobRow>(
    `
INSERT INTO jobs (
  id,
  user_id,
  league_id,
  league_season_id,
  kind,
  status,
  idempotency_key,
  input_hash,
  input_json,
  progress_json,
  attempt_count,
  max_attempts,
  available_at,
  created_at,
  updated_at
) VALUES ($1, $2, $3, $4, $5, 'queued', $6, $7, $8::jsonb, $9::jsonb, 0, $10, $11, $11, $11)
ON CONFLICT ON CONSTRAINT jobs_user_league_season_idempotency_key DO NOTHING
RETURNING *;
`.trim(),
    [
      createJobId(),
      input.userId,
      input.leagueId,
      input.seasonId,
      input.kind,
      input.idempotencyKey,
      inputHash,
      jsonbParameter(input.inputJson),
      jsonbParameter(queuedProgress),
      input.maxAttempts ?? defaultMaxAttempts,
      now,
    ],
  );
  const inserted = firstRow(result);
  if (inserted !== undefined) return jobFromRow(inserted);

  const existing = await findByIdempotencyKey(context, input, client);
  if (existing === null) {
    throw new Error("Postgres job idempotency conflict did not return an existing row.");
  }
  if (existing.inputHash !== inputHash) {
    throw new JobError(
      "idempotency_conflict",
      "A job already exists for this idempotency key with different input.",
    );
  }
  return existing;
};

export const submitJob = async (
  context: JobQueueContext,
  input: SubmitJobInput,
): Promise<JobRecord> =>
  await context.client.transaction(async transactionClient => {
    await pruneTerminalHistory(input.userId, transactionClient);
    return await submitJobWithClient(context, input, transactionClient);
  });
