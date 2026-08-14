import type { JobRecord, MaybePromise } from "../jobs.js";
import type { EnqueueHistoricalImportParseJobInput } from "./enqueueContracts.js";
import type { HistoricalImportParseJobPayload } from "./payloads.js";
import { platformJobTypes } from "./platformJobTypes.js";
import type {
  PlatformJobAsyncSubmitRepository,
  PlatformJobSubmitRepository,
} from "./repositoryContracts.js";
import { submitPlatformJob } from "./submitPlatformJob.js";

export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobSubmitRepository>,
): JobRecord;
export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord>;
export function enqueueHistoricalImportParseJob(
  input: EnqueueHistoricalImportParseJobInput<PlatformJobAsyncSubmitRepository>,
): MaybePromise<JobRecord> {
  const payload: HistoricalImportParseJobPayload = {
    type: platformJobTypes.historicalImportParse,
    seasonYear: input.seasonYear,
    fileHash: input.fileHash,
    sourceFilename: input.sourceFilename,
  };
  if (input.contentType !== undefined) payload.contentType = input.contentType;
  if (input.mappingConfig !== undefined) payload.mappingConfig = input.mappingConfig;
  if (input.replacementRequested !== undefined) {
    payload.replacementRequested = input.replacementRequested;
  }

  return submitPlatformJob({
    ...input,
    payload,
    defaultIdempotencyKeyParts: [input.seasonYear, input.fileHash],
  });
}
