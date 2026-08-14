import type {
  CancelJobAtRunBoundaryInput,
  CancelJobInput,
  ClaimNextJobInput,
  CompleteJobInput,
  FailJobInput,
  HeartbeatJobInput,
  JobRecord,
  JobRepository,
  RerunJobInput,
  SubmitJobInput,
  UpdateJobProgressInput,
} from "../jobs.js";
import type { JobHistoryPage, ListJobsForUserInput } from "../jobHistory.js";
import { cancelJob, cancelJobAtRunBoundary } from "./cancel.js";
import { claimNextJob } from "./claim.js";
import { completeJob } from "./complete.js";
import { failJob } from "./fail.js";
import { rerunJob } from "./rerun.js";
import { submitJob } from "./submit.js";
import type {
  JobQueueContext,
  PostgresTransactionalQueryClient,
} from "./types.js";
import {
  fetchJobForUser,
  listJobPageForUser,
  listJobsForUser,
} from "./userHistory.js";
import { heartbeatJob, updateJobProgress } from "./workerLifecycle.js";

export class PostgresJobQueue implements JobRepository {
  readonly #context: JobQueueContext;

  constructor(client: PostgresTransactionalQueryClient) {
    this.#context = { client };
  }

  async submit(input: SubmitJobInput): Promise<JobRecord> {
    return await submitJob(this.#context, input);
  }

  async claimNextJob(input: ClaimNextJobInput): Promise<JobRecord | null> {
    return await claimNextJob(this.#context, input);
  }

  async updateProgress(input: UpdateJobProgressInput): Promise<JobRecord> {
    return await updateJobProgress(this.#context, input);
  }

  async heartbeatJob(input: HeartbeatJobInput): Promise<JobRecord> {
    return await heartbeatJob(this.#context, input);
  }

  async completeJob(input: CompleteJobInput): Promise<JobRecord> {
    return await completeJob(this.#context, input);
  }

  async failJob(input: FailJobInput): Promise<JobRecord> {
    return await failJob(this.#context, input);
  }

  async cancelJob(input: CancelJobInput): Promise<JobRecord> {
    return await cancelJob(this.#context, input);
  }

  async cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): Promise<JobRecord> {
    return await cancelJobAtRunBoundary(this.#context, input);
  }

  async rerunJob(input: RerunJobInput): Promise<JobRecord> {
    return await rerunJob(this.#context, input);
  }

  async listForUser(userId: string): Promise<JobRecord[]> {
    return await listJobsForUser(this.#context, userId);
  }

  async listPageForUser(input: ListJobsForUserInput): Promise<JobHistoryPage> {
    return await listJobPageForUser(this.#context, input);
  }

  async fetchForUser(jobId: string, userId: string): Promise<JobRecord | null> {
    return await fetchJobForUser(this.#context, jobId, userId);
  }
}
