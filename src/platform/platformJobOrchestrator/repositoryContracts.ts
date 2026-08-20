import type {
  JobRecord,
  JobRepository,
  MaybePromise,
  SubmitJobInput,
} from "../jobs.js";

export type PlatformJobRepository = Pick<
  JobRepository,
  "claimNextJob" | "updateProgress" | "heartbeatJob" | "completeJob" | "failJob" | "cancelJobAtRunBoundary"
> & Partial<Pick<JobRepository, "recordWorkerHeartbeat">>;

export interface PlatformJobSubmitRepository {
  submit(input: SubmitJobInput): JobRecord;
}

export interface PlatformJobAsyncSubmitRepository {
  submit(input: SubmitJobInput): MaybePromise<JobRecord>;
}
