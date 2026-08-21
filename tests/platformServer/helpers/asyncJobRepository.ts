import {
  InMemoryJobQueue,
  type CancelJobAtRunBoundaryInput,
  type CancelJobInput,
  type ClaimNextJobInput,
  type CompleteJobInput,
  type FailJobInput,
  type HeartbeatJobInput,
  type JobRecord,
  type JobRepository,
  type RerunJobInput,
  type SubmitJobInput,
  type UpdateJobProgressInput,
} from "../../../src/platform/jobs.js";
import type { JobHistoryPage, ListJobsForUserInput } from "../../../src/platform/jobHistory.js";

export class AsyncJobRepository implements JobRepository {
  readonly inner = new InMemoryJobQueue();

  async submit(input: SubmitJobInput): Promise<JobRecord> {
    return this.inner.submit(input);
  }

  async claimNextJob(input: ClaimNextJobInput): Promise<JobRecord | null> {
    return this.inner.claimNextJob(input);
  }

  async updateProgress(input: UpdateJobProgressInput): Promise<JobRecord> {
    return this.inner.updateProgress(input);
  }

  async heartbeatJob(input: HeartbeatJobInput): Promise<JobRecord> {
    return this.inner.heartbeatJob(input);
  }

  async completeJob(input: CompleteJobInput): Promise<JobRecord> {
    return this.inner.completeJob(input);
  }

  async failJob(input: FailJobInput): Promise<JobRecord> {
    return this.inner.failJob(input);
  }

  async cancelJob(input: CancelJobInput): Promise<JobRecord> {
    return this.inner.cancelJob(input);
  }

  async cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): Promise<JobRecord> {
    return this.inner.cancelJobAtRunBoundary(input);
  }

  async rerunJob(input: RerunJobInput): Promise<JobRecord> {
    return this.inner.rerunJob(input);
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return this.inner.listForUser(userId);
  }

  async listPageForUser(input: ListJobsForUserInput): Promise<JobHistoryPage> {
    return this.inner.listPageForUser(input);
  }

  async fetchForUser(jobId: string, userId: string): Promise<JobRecord | null> {
    return this.inner.fetchForUser(jobId, userId);
  }
}
