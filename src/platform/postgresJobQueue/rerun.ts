import {
  JobError,
  createJobId,
  isTerminalJob,
  jobRerunIdempotencyKeyFor,
  type JobRecord,
  type RerunJobInput,
  type SubmitJobInput,
} from "../jobs.js";
import {
  simulationRerunIdempotencyKey,
  simulationRunIdForJob,
} from "../jobRerunPolicy.js";
import { queuedProgress } from "./constants.js";
import { jobFromRow } from "./jobRow.js";
import { jsonbParameter } from "./json.js";
import { findByIdempotencyKey, requireJobOwnedBy } from "./lookups.js";
import { pruneTerminalHistory } from "./prune.js";
import { simulationRerunSql } from "./sql.js";
import { submitJob } from "./submit.js";
import { firstRow, type JobQueueContext, type JobRow } from "./types.js";

const rerunSimulationJob = async (
  context: JobQueueContext,
  originalJob: JobRecord,
  simulationRunId: string,
  now: Date,
): Promise<JobRecord> => {
  const idempotencyKey = simulationRerunIdempotencyKey(simulationRunId);
  const lookupInput: SubmitJobInput = {
    userId: originalJob.userId,
    leagueId: originalJob.leagueId,
    seasonId: originalJob.seasonId,
    kind: originalJob.kind,
    inputJson: originalJob.inputJson,
    idempotencyKey,
    maxAttempts: originalJob.maxAttempts,
    now,
  };

  return await context.client.transaction(async transactionClient => {
    await pruneTerminalHistory(originalJob.userId, transactionClient);
    const result = await transactionClient.query<JobRow>(simulationRerunSql, [
      createJobId(),
      originalJob.userId,
      originalJob.leagueId,
      originalJob.seasonId,
      originalJob.kind,
      idempotencyKey,
      originalJob.inputHash,
      jsonbParameter(originalJob.inputJson),
      jsonbParameter(queuedProgress),
      originalJob.maxAttempts,
      now,
    ]);
    const row = firstRow(result);
    if (row !== undefined) return jobFromRow(row);

    const activeJob = await findByIdempotencyKey(context, lookupInput, transactionClient);
    if (activeJob !== null && !isTerminalJob(activeJob)) {
      throw new JobError(
        "job_already_active",
        "A rerun is already queued or running for this simulation.",
      );
    }
    throw new Error("Postgres simulation rerun conflict did not return an active job.");
  });
};

export const rerunJob = async (
  context: JobQueueContext,
  input: RerunJobInput,
): Promise<JobRecord> => {
  const originalJob = await requireJobOwnedBy(context, input.jobId, input.userId);
  if (!isTerminalJob(originalJob)) {
    throw new JobError(
      "job_not_terminal",
      "Only completed, failed, or canceled jobs can be rerun.",
    );
  }

  const rerunIdempotencyKey = input.idempotencyKey.trim();
  if (rerunIdempotencyKey.length === 0) {
    throw new JobError("idempotency_key_required", "Rerun jobs require an idempotency key.");
  }

  const simulationRunId = simulationRunIdForJob(originalJob);
  if (simulationRunId !== undefined) {
    return await rerunSimulationJob(
      context,
      originalJob,
      simulationRunId,
      input.now ?? new Date(),
    );
  }

  return await submitJob(context, {
    userId: originalJob.userId,
    leagueId: originalJob.leagueId,
    seasonId: originalJob.seasonId,
    kind: originalJob.kind,
    inputJson: originalJob.inputJson,
    idempotencyKey: jobRerunIdempotencyKeyFor(originalJob.id, rerunIdempotencyKey),
    maxAttempts: originalJob.maxAttempts,
    now: input.now,
  });
};
