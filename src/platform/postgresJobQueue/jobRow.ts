import type {
  JobKind,
  JobProgress,
  JobRecord,
  JobStatus,
  JsonValue,
  SanitizedJobError,
} from "../jobs.js";
import { queuedProgress } from "./constants.js";
import { jsonValueFromDb } from "./json.js";
import type { JobRow } from "./types.js";

export type { JobRow } from "./types.js";

const jobKinds: readonly JobKind[] = ["import", "model_run", "simulation", "export"];
const jobStatuses: readonly JobStatus[] = [
  "queued",
  "running",
  "completed",
  "failed",
  "canceled",
];

const jobKindFromDb = (value: string): JobKind => {
  const kind = jobKinds.find(candidate => candidate === value);
  if (kind === undefined) throw new Error("Postgres jobs row has invalid kind.");
  return kind;
};

const jobStatusFromDb = (value: string): JobStatus => {
  const status = jobStatuses.find(candidate => candidate === value);
  if (status === undefined) throw new Error("Postgres jobs row has invalid status.");
  return status;
};

const dateFromDb = (value: Date | string | null | undefined): Date | undefined => {
  if (value === undefined || value === null) return undefined;
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
};

const requiredDateFromDb = (field: string, value: Date | string): Date => {
  const date = dateFromDb(value);
  if (date === undefined) throw new Error(`Postgres jobs row has invalid ${field}.`);
  return date;
};

const isJsonObject = (
  value: JsonValue | undefined,
): value is { readonly [key: string]: JsonValue | undefined } =>
  value !== undefined && value !== null && typeof value === "object" && !Array.isArray(value);

const progressFromDb = (value: unknown): JobProgress => {
  const jsonValue = jsonValueFromDb("progress_json", value);
  if (!isJsonObject(jsonValue)) return { ...queuedProgress };
  return {
    completed: Number(jsonValue.completed ?? 0),
    total: Number(jsonValue.total ?? 1),
    message: typeof jsonValue.message === "string" ? jsonValue.message : "",
  };
};

const sanitizedErrorFromDb = (value: unknown): SanitizedJobError | undefined => {
  const jsonValue = jsonValueFromDb("sanitized_error_json", value);
  if (!isJsonObject(jsonValue)) return undefined;
  const name = typeof jsonValue.name === "string" ? jsonValue.name : undefined;
  const message = typeof jsonValue.message === "string" ? jsonValue.message : undefined;
  return name === undefined || message === undefined ? undefined : { name, message };
};

export const jobFromRow = (row: JobRow): JobRecord => ({
  id: row.id,
  userId: row.user_id,
  leagueId: row.league_id,
  seasonId: row.league_season_id,
  kind: jobKindFromDb(row.kind),
  status: jobStatusFromDb(row.status),
  inputJson: jsonValueFromDb("input_json", row.input_json) ?? null,
  inputHash: row.input_hash,
  idempotencyKey: row.idempotency_key,
  progress: progressFromDb(row.progress_json),
  attempts: Number(row.attempt_count),
  maxAttempts: Number(row.max_attempts),
  workerId: row.locked_by ?? undefined,
  lockedAt: dateFromDb(row.locked_at),
  heartbeatAt: dateFromDb(row.heartbeat_at),
  lockExpiresAt: dateFromDb(row.lock_expires_at),
  startedAt: dateFromDb(row.started_at),
  finishedAt: dateFromDb(row.finished_at),
  cancellationRequestedAt: dateFromDb(row.cancellation_requested_at),
  resultSummary: jsonValueFromDb("result_summary_json", row.result_summary_json),
  sanitizedError: sanitizedErrorFromDb(row.sanitized_error_json),
  createdAt: requiredDateFromDb("created_at", row.created_at),
  updatedAt: requiredDateFromDb("updated_at", row.updated_at),
});
