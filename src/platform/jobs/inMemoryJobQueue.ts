import type { JobHistoryPage, ListJobsForUserInput } from "../jobHistory.js";
import { canAccessJob } from "./access.js";
import { cancelJob, cancelJobAtRunBoundary } from "./cancellation.js";
import { claimNextJob } from "./claim.js";
import { completeJob, failJob } from "./completion.js";
import type {
  CancelJobAtRunBoundaryInput,
  CancelJobInput,
  ClaimNextJobInput,
  CompleteJobInput,
  FailJobInput,
  HeartbeatJobInput,
  JobRecord,
  RerunJobInput,
  SubmitJobInput,
  UpdateJobProgressInput,
} from "./contracts.js";
import { listJobPageForUser, listJobsForUser } from "./history.js";
import { InMemoryJobStore } from "./inMemoryJobStore.js";
import { heartbeatJob, updateJobProgress } from "./progress.js";
import type { JobRepository } from "./repositoryContracts.js";
import { rerunJob } from "./rerun.js";
import { submitJob } from "./submit.js";

export class InMemoryJobQueue implements JobRepository {
  readonly #store = new InMemoryJobStore();

  submit(input: SubmitJobInput): JobRecord {
    return submitJob(this.#store, input);
  }

  claimNextJob(input: ClaimNextJobInput): JobRecord | null {
    return claimNextJob(this.#store, input);
  }

  updateProgress(input: UpdateJobProgressInput): JobRecord {
    return updateJobProgress(this.#store, input);
  }

  heartbeatJob(input: HeartbeatJobInput): JobRecord {
    return heartbeatJob(this.#store, input);
  }

  completeJob(input: CompleteJobInput): JobRecord {
    return completeJob(this.#store, input);
  }

  failJob(input: FailJobInput): JobRecord {
    return failJob(this.#store, input);
  }

  cancelJob(input: CancelJobInput): JobRecord {
    return cancelJob(this.#store, input);
  }

  cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): JobRecord {
    return cancelJobAtRunBoundary(this.#store, input);
  }

  rerunJob(input: RerunJobInput): JobRecord {
    return rerunJob(this.#store, input);
  }

  listForUser(userId: string): JobRecord[] {
    return listJobsForUser(this.#store, userId);
  }

  listPageForUser(input: ListJobsForUserInput): JobHistoryPage {
    return listJobPageForUser(this.#store, input);
  }

  fetchForUser(jobId: string, userId: string): JobRecord | null {
    const job = this.#store.jobById(jobId);

    return job === undefined || !canAccessJob(userId, job) ? null : job;
  }

  jobs(): readonly JobRecord[] {
    return this.#store.snapshots();
  }

  replaceJobs(jobs: readonly JobRecord[]): void {
    this.#store.replace(jobs);
  }
}
