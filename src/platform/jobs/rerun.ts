import {
  simulationRerunIdempotencyKey,
  simulationRunIdForJob,
} from "../jobRerunPolicy.js";
import type { JobRecord, RerunJobInput } from "./contracts.js";
import { JobError } from "./errors.js";
import { idempotencyIndexKey, jobRerunIdempotencyKeyFor } from "./identifiers.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { findJobForUser } from "./lookups.js";
import { resetJobForRerun } from "./recordLifecycle.js";
import { isTerminalJob } from "./status.js";
import { submitJob } from "./submit.js";

const rerunSimulationJob = (
  store: InMemoryJobStore,
  originalJob: JobRecord,
  simulationRunId: string,
  now: Date,
): JobRecord => {
  const idempotencyKey = simulationRerunIdempotencyKey(simulationRunId);
  const indexKey = idempotencyIndexKey(
    originalJob.userId,
    originalJob.leagueId,
    originalJob.seasonId,
    idempotencyKey,
  );
  const existing = store.jobByIdempotencyKey(indexKey);

  if (existing !== undefined) {
    if (!isTerminalJob(existing)) {
      throw new JobError(
        "job_already_active",
        "A rerun is already queued or running for this simulation.",
      );
    }

    return resetJobForRerun(existing, now);
  }

  return submitJob(store, {
    userId: originalJob.userId,
    leagueId: originalJob.leagueId,
    seasonId: originalJob.seasonId,
    kind: originalJob.kind,
    inputJson: originalJob.inputJson,
    idempotencyKey,
    maxAttempts: originalJob.maxAttempts,
    now,
  });
};

export const rerunJob = (store: InMemoryJobStore, input: RerunJobInput): JobRecord => {
  const originalJob = findJobForUser(store, input.jobId, input.userId);

  if (!isTerminalJob(originalJob)) {
    throw new JobError("job_not_terminal", "Only completed, failed, or canceled jobs can be rerun.");
  }

  const rerunIdempotencyKey = input.idempotencyKey.trim();
  if (rerunIdempotencyKey.length === 0) {
    throw new JobError("idempotency_key_required", "Rerun jobs require an idempotency key.");
  }

  const simulationRunId = simulationRunIdForJob(originalJob);
  if (simulationRunId !== undefined) {
    return rerunSimulationJob(store, originalJob, simulationRunId, input.now ?? new Date());
  }

  return submitJob(store, {
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
