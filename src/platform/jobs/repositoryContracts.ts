import type { JobHistoryPage, ListJobsForUserInput } from "../jobHistory.js";
import type {
  CancelJobAtRunBoundaryInput,
  CancelJobInput,
  ClaimNextJobInput,
  CompleteJobInput,
  FailJobInput,
  HeartbeatJobInput,
  JobRecord,
  MaybePromise,
  RerunJobInput,
  SubmitJobInput,
  UpdateJobProgressInput,
} from "./contracts.js";

export interface JobRepository {
  submit(input: SubmitJobInput): MaybePromise<JobRecord>;
  claimNextJob(input: ClaimNextJobInput): MaybePromise<JobRecord | null>;
  updateProgress(input: UpdateJobProgressInput): MaybePromise<JobRecord>;
  heartbeatJob(input: HeartbeatJobInput): MaybePromise<JobRecord>;
  completeJob(input: CompleteJobInput): MaybePromise<JobRecord>;
  failJob(input: FailJobInput): MaybePromise<JobRecord>;
  cancelJob(input: CancelJobInput): MaybePromise<JobRecord>;
  cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): MaybePromise<JobRecord>;
  rerunJob(input: RerunJobInput): MaybePromise<JobRecord>;
  listPageForUser(input: ListJobsForUserInput): MaybePromise<JobHistoryPage>;
  listForUser(userId: string): MaybePromise<JobRecord[]>;
  fetchForUser(jobId: string, userId: string): MaybePromise<JobRecord | null>;
}
