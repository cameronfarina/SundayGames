import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueuePricingRebuildJobInput } from "./enqueueContracts.js";
import type { PricingRebuildJobPayload } from "./payloads.js";
import { platformJobTypes } from "./platformJobTypes.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import { submitPlatformJob } from "./submitPlatformJob.js";

export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueuePricingRebuildJob(
  input: EnqueuePricingRebuildJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: PricingRebuildJobPayload = {
    type: platformJobTypes.pricingRebuild,
    seasonYear: input.seasonYear,
    modelVersion: input.modelVersion,
    inputSnapshotId: input.inputSnapshotId,
    inputHash: input.inputHash,
    scenarioIds: [...input.scenarioIds],
    reason: input.reason,
  };
  if (input.strategyOverlayIds !== undefined) {
    payload.strategyOverlayIds = [...input.strategyOverlayIds];
  }

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [
      input.modelVersion,
      input.inputSnapshotId,
      input.scenarioIds.join(","),
    ],
  });
}
