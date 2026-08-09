import { createHash, randomBytes } from "node:crypto";

export type JobKind = "import" | "model_run" | "simulation" | "export";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

export type JobErrorCode =
  | "idempotency_conflict"
  | "job_not_found"
  | "job_owner_required"
  | "job_not_running"
  | "job_lock_mismatch"
  | "job_not_claimable";

export class JobError extends Error {
  readonly code: JobErrorCode;

  constructor(code: JobErrorCode, message: string) {
    super(message);
    this.name = "JobError";
    this.code = code;
  }
}

export interface JobProgress {
  completed: number;
  total: number;
  message: string;
}

export type JsonPrimitive = string | number | boolean | null;
export type JsonArray = readonly JsonValue[];
export type JsonObject = { readonly [key: string]: JsonValue | undefined };
export type JsonValue = JsonPrimitive | JsonArray | JsonObject;

export interface SanitizedJobError {
  name: string;
  message: string;
}

export interface JobRecord {
  id: string;
  userId: string;
  leagueId: string;
  seasonId: string;
  kind: JobKind;
  status: JobStatus;
  inputJson: JsonValue;
  inputHash: string;
  idempotencyKey: string;
  progress: JobProgress;
  attempts: number;
  maxAttempts: number;
  workerId: string | undefined;
  lockedAt: Date | undefined;
  heartbeatAt: Date | undefined;
  lockExpiresAt: Date | undefined;
  startedAt: Date | undefined;
  finishedAt: Date | undefined;
  cancellationRequestedAt: Date | undefined;
  resultSummary: JsonValue | undefined;
  sanitizedError: SanitizedJobError | undefined;
  createdAt: Date;
  updatedAt: Date;
}

export type MaybePromise<T> = T | Promise<T>;

export interface SubmitJobInput {
  userId: string;
  leagueId: string;
  seasonId: string;
  kind: JobKind;
  inputJson: JsonValue;
  idempotencyKey: string;
  now?: Date | undefined;
  maxAttempts?: number | undefined;
}

export interface ClaimNextJobInput {
  workerId: string;
  now?: Date | undefined;
  lockTtlMs?: number | undefined;
  kinds?: readonly JobKind[] | undefined;
}

export interface UpdateJobProgressInput {
  jobId: string;
  workerId: string;
  progress: JobProgress;
  now?: Date | undefined;
}

export interface HeartbeatJobInput {
  jobId: string;
  workerId: string;
  now?: Date | undefined;
  lockTtlMs?: number | undefined;
}

export interface CompleteJobInput {
  jobId: string;
  workerId: string;
  resultSummary: JsonValue;
  now?: Date | undefined;
}

export interface FailJobInput {
  jobId: string;
  workerId: string;
  error: unknown;
  now?: Date | undefined;
}

export interface CancelJobInput {
  jobId: string;
  userId: string;
  now?: Date | undefined;
}

export interface CancelJobAtRunBoundaryInput {
  jobId: string;
  workerId: string;
  now?: Date | undefined;
}

export interface JobRepository {
  submit(input: SubmitJobInput): MaybePromise<JobRecord>;
  claimNextJob(input: ClaimNextJobInput): MaybePromise<JobRecord | null>;
  updateProgress(input: UpdateJobProgressInput): MaybePromise<JobRecord>;
  heartbeatJob(input: HeartbeatJobInput): MaybePromise<JobRecord>;
  completeJob(input: CompleteJobInput): MaybePromise<JobRecord>;
  failJob(input: FailJobInput): MaybePromise<JobRecord>;
  cancelJob(input: CancelJobInput): MaybePromise<JobRecord>;
  cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): MaybePromise<JobRecord>;
  listForUser(userId: string): MaybePromise<JobRecord[]>;
  fetchForUser(jobId: string, userId: string): MaybePromise<JobRecord | null>;
}

export const defaultMaxAttempts = 3;
export const defaultLockTtlMs = 60_000;
const jobIdBytes = 16;

export const createJobId = (): string => `job_${randomBytes(jobIdBytes).toString("base64url")}`;

const idempotencyIndexKey = (
  userId: string,
  leagueId: string,
  seasonId: string,
  idempotencyKey: string,
): string =>
  [userId, leagueId, seasonId, idempotencyKey].join("\0");

const stableStringify = (value: unknown): string => {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(item => stableStringify(item)).join(",")}]`;
  }

  const entries = Object.entries(value).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey));
  const serializedEntries = entries
    .filter(([, entryValue]) => entryValue !== undefined)
    .map(([entryKey, entryValue]) => `${JSON.stringify(entryKey)}:${stableStringify(entryValue)}`);

  return `{${serializedEntries.join(",")}}`;
};

export const hashJobInput = (inputJson: JsonValue): string =>
  createHash("sha256").update(stableStringify(inputJson)).digest("base64url");

export const canAccessJob = (userId: string, job: JobRecord): boolean => job.userId === userId;

export class InMemoryJobQueue implements JobRepository {
  readonly #jobsById = new Map<string, JobRecord>();
  readonly #jobIdsByIdempotencyKey = new Map<string, string>();

  submit(input: SubmitJobInput): JobRecord {
    const now = input.now ?? new Date();
    const inputHash = hashJobInput(input.inputJson);
    const indexKey = idempotencyIndexKey(
      input.userId,
      input.leagueId,
      input.seasonId,
      input.idempotencyKey,
    );
    const existingJobId = this.#jobIdsByIdempotencyKey.get(indexKey);

    if (existingJobId !== undefined) {
      const existingJob = this.#jobsById.get(existingJobId);

      if (existingJob !== undefined) {
        if (existingJob.inputHash !== inputHash) {
          throw new JobError(
            "idempotency_conflict",
            "A job already exists for this idempotency key with different input.",
          );
        }

        return existingJob;
      }
    }

    const job: JobRecord = {
      id: createJobId(),
      userId: input.userId,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      kind: input.kind,
      status: "queued",
      inputJson: input.inputJson,
      inputHash,
      idempotencyKey: input.idempotencyKey,
      progress: { completed: 0, total: 1, message: "Queued" },
      attempts: 0,
      maxAttempts: input.maxAttempts ?? defaultMaxAttempts,
      workerId: undefined,
      lockedAt: undefined,
      heartbeatAt: undefined,
      lockExpiresAt: undefined,
      startedAt: undefined,
      finishedAt: undefined,
      cancellationRequestedAt: undefined,
      resultSummary: undefined,
      sanitizedError: undefined,
      createdAt: now,
      updatedAt: now,
    };

    this.#storeJob(job);

    return job;
  }

  claimNextJob(input: ClaimNextJobInput): JobRecord | null {
    const now = input.now ?? new Date();
    const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
    const job = [...this.#jobsById.values()]
      .filter(candidateJob =>
        (input.kinds === undefined || input.kinds.includes(candidateJob.kind)) &&
        (
          candidateJob.status === "queued" ||
          (candidateJob.status === "running" &&
            candidateJob.cancellationRequestedAt === undefined &&
            candidateJob.lockExpiresAt !== undefined &&
            candidateJob.lockExpiresAt.getTime() <= now.getTime())
        )
      )
      .sort((leftJob, rightJob) => {
        const createdAtOrder = leftJob.createdAt.getTime() - rightJob.createdAt.getTime();

        return createdAtOrder === 0 ? leftJob.id.localeCompare(rightJob.id) : createdAtOrder;
      })[0];

    if (job === undefined) {
      return null;
    }

    job.status = "running";
    job.workerId = input.workerId;
    job.lockedAt = now;
    job.heartbeatAt = now;
    job.lockExpiresAt = new Date(now.getTime() + lockTtlMs);
    job.startedAt = job.startedAt ?? now;
    job.updatedAt = now;

    return job;
  }

  updateProgress(input: UpdateJobProgressInput): JobRecord {
    const now = input.now ?? new Date();
    const job = this.#findRunningLockedJob(input.jobId, input.workerId);

    job.progress = { ...input.progress };
    job.heartbeatAt = now;
    job.updatedAt = now;

    return job;
  }

  heartbeatJob(input: HeartbeatJobInput): JobRecord {
    const now = input.now ?? new Date();
    const lockTtlMs = input.lockTtlMs ?? defaultLockTtlMs;
    const job = this.#findRunningLockedJob(input.jobId, input.workerId);

    job.heartbeatAt = now;
    job.lockExpiresAt = new Date(now.getTime() + lockTtlMs);
    job.updatedAt = now;

    return job;
  }

  completeJob(input: CompleteJobInput): JobRecord {
    const now = input.now ?? new Date();
    const job = this.#findRunningLockedJob(input.jobId, input.workerId);

    job.status = "completed";
    job.progress = { completed: 1, total: 1, message: "Completed" };
    job.resultSummary = input.resultSummary;
    job.finishedAt = now;
    job.updatedAt = now;
    this.#clearLock(job);

    return job;
  }

  failJob(input: FailJobInput): JobRecord {
    const now = input.now ?? new Date();
    const job = this.#findRunningLockedJob(input.jobId, input.workerId);

    job.attempts += 1;
    job.sanitizedError = sanitizeJobError(input.error);
    job.updatedAt = now;
    this.#clearLock(job);

    if (job.attempts < job.maxAttempts) {
      job.status = "queued";
      return job;
    }

    job.status = "failed";
    job.finishedAt = now;

    return job;
  }

  cancelJob(input: CancelJobInput): JobRecord {
    const now = input.now ?? new Date();
    const job = this.#findJobForUser(input.jobId, input.userId);

    if (job.status === "queued") {
      job.status = "canceled";
      job.cancellationRequestedAt = now;
      job.finishedAt = now;
      job.updatedAt = now;
      return job;
    }

    if (job.status === "running") {
      job.cancellationRequestedAt = now;
      job.updatedAt = now;
      return job;
    }

    return job;
  }

  cancelJobAtRunBoundary(input: CancelJobAtRunBoundaryInput): JobRecord {
    const now = input.now ?? new Date();
    const job = this.#findRunningLockedJob(input.jobId, input.workerId);

    if (job.cancellationRequestedAt === undefined) {
      throw new JobError("job_not_claimable", "Job has not requested cancellation.");
    }

    job.status = "canceled";
    job.finishedAt = now;
    job.updatedAt = now;
    this.#clearLock(job);

    return job;
  }

  listForUser(userId: string): JobRecord[] {
    return [...this.#jobsById.values()].filter(job => job.userId === userId);
  }

  fetchForUser(jobId: string, userId: string): JobRecord | null {
    const job = this.#jobsById.get(jobId);

    if (job === undefined || !canAccessJob(userId, job)) {
      return null;
    }

    return job;
  }

  jobs(): readonly JobRecord[] {
    return [...this.#jobsById.values()].map(job => structuredClone(job));
  }

  replaceJobs(jobs: readonly JobRecord[]): void {
    this.#jobsById.clear();
    this.#jobIdsByIdempotencyKey.clear();

    for (const job of jobs) {
      this.#storeJob(structuredClone(job));
    }
  }

  #storeJob(job: JobRecord): void {
    this.#jobsById.set(job.id, job);
    this.#jobIdsByIdempotencyKey.set(
      idempotencyIndexKey(
        job.userId,
        job.leagueId,
        job.seasonId,
        job.idempotencyKey,
      ),
      job.id,
    );
  }

  #findJobForUser(jobId: string, userId: string): JobRecord {
    const job = this.#jobsById.get(jobId);

    if (job === undefined) {
      throw new JobError("job_not_found", "Job was not found.");
    }

    if (job.userId !== userId) {
      throw new JobError("job_owner_required", "Job belongs to another user.");
    }

    return job;
  }

  #findRunningLockedJob(jobId: string, workerId: string): JobRecord {
    const job = this.#jobsById.get(jobId);

    if (job === undefined) {
      throw new JobError("job_not_found", "Job was not found.");
    }

    if (job.status !== "running") {
      throw new JobError("job_not_running", "Job is not running.");
    }

    if (job.workerId !== workerId) {
      throw new JobError("job_lock_mismatch", "Job is locked by another worker.");
    }

    return job;
  }

  #clearLock(job: JobRecord): void {
    job.workerId = undefined;
    job.lockedAt = undefined;
    job.heartbeatAt = undefined;
    job.lockExpiresAt = undefined;
  }
}

const safeErrorNamePattern = /^[A-Za-z][A-Za-z0-9_.-]{0,63}$/;

const sanitizeJobErrorName = (error: unknown): string => {
  if (!(error instanceof Error) || !safeErrorNamePattern.test(error.name)) {
    return "Error";
  }

  return error.name;
};

export const sanitizeJobError = (error: unknown): SanitizedJobError => ({
  name: sanitizeJobErrorName(error),
  message: "Job failed. Check worker logs for details.",
});
