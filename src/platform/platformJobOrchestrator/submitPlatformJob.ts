import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueuePlatformJobInput } from "./enqueueContracts.js";
import { idempotencyKeyFor } from "./idempotency.js";
import { jobKindFor } from "./jobKinds.js";
import type { PlatformJobPayload } from "./payloads.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";

interface SubmitPlatformJobInput<TRepository extends PlatformJobAsyncSubmitRepository>
  extends EnqueuePlatformJobInput<TRepository> {
  payload: PlatformJobPayload;
  defaultIdempotencyKeyParts: readonly (string | number)[];
}

export function submitPlatformJob(
  input: SubmitPlatformJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function submitPlatformJob(
  input: SubmitPlatformJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function submitPlatformJob(
  input: SubmitPlatformJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  return input.repository.submit({
    userId: input.userId,
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    kind: jobKindFor(input.payload.type),
    inputJson: input.payload,
    idempotencyKey: idempotencyKeyFor(
      input.payload.type,
      input.idempotencyKey,
      input.defaultIdempotencyKeyParts,
    ),
    maxAttempts: input.maxAttempts,
    now: input.now,
  });
}
