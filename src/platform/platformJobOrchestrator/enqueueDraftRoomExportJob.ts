import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueueDraftRoomExportJobInput } from "./enqueueContracts.js";
import type { DraftRoomExportJobPayload } from "./payloads.js";
import { platformJobTypes } from "./platformJobTypes.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import { submitPlatformJob } from "./submitPlatformJob.js";

export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueDraftRoomExportJob(
  input: EnqueueDraftRoomExportJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: DraftRoomExportJobPayload = {
    type: platformJobTypes.draftRoomExport,
    draftRoomId: input.draftRoomId,
    format: input.format,
    sourceRevision: input.sourceRevision,
  };

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [input.draftRoomId, input.sourceRevision, input.format],
  });
}
