export type JobKind = "import" | "model_run" | "simulation" | "export";
export type JobStatus = "queued" | "running" | "completed" | "failed" | "canceled";

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

export interface RerunJobInput {
  jobId: string;
  userId: string;
  idempotencyKey: string;
  now?: Date | undefined;
}
