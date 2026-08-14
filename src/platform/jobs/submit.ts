import type { JobRecord, SubmitJobInput } from "./contracts.js";
import { JobError } from "./errors.js";
import { idempotencyIndexKey } from "./identifiers.js";
import type { InMemoryJobStore } from "./inMemoryJobStore.js";
import { hashJobInput } from "./inputHash.js";
import { createQueuedJob } from "./recordLifecycle.js";

export const submitJob = (store: InMemoryJobStore, input: SubmitJobInput): JobRecord => {
  const now = input.now ?? new Date();
  const inputHash = hashJobInput(input.inputJson);
  const indexKey = idempotencyIndexKey(
    input.userId,
    input.leagueId,
    input.seasonId,
    input.idempotencyKey,
  );
  const existingJob = store.jobByIdempotencyKey(indexKey);

  if (existingJob !== undefined) {
    if (existingJob.inputHash !== inputHash) {
      throw new JobError(
        "idempotency_conflict",
        "A job already exists for this idempotency key with different input.",
      );
    }

    return existingJob;
  }

  const job = createQueuedJob(input, inputHash, now);
  store.store(job);

  return job;
};
