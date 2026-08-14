import type {
  JobKind,
  JobRecord,
  JobStatus,
  SanitizedJobError,
} from "../../jobs.js";
import { jsonValue } from "./json.js";
import {
  dateValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const kindValue = (value: unknown, path: string): JobKind => {
  if (value === "import" || value === "model_run" || value === "simulation" || value === "export") {
    return value;
  }
  return invalidSnapshot(path);
};

const statusValue = (value: unknown, path: string): JobStatus => {
  if (value === "queued" || value === "running" || value === "completed"
    || value === "failed" || value === "canceled") return value;
  return invalidSnapshot(path);
};

const errorValue = (value: unknown, path: string): SanitizedJobError => {
  const record = recordValue(value, path);
  return {
    name: stringValue(record.name, `${path}.name`),
    message: stringValue(record.message, `${path}.message`),
  };
};

export const jobValue = (value: unknown, path: string): JobRecord => {
  const record = recordValue(value, path);
  const progress = recordValue(record.progress, `${path}.progress`);
  return {
    id: stringValue(record.id, `${path}.id`),
    userId: stringValue(record.userId, `${path}.userId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    kind: kindValue(record.kind, `${path}.kind`),
    status: statusValue(record.status, `${path}.status`),
    inputJson: jsonValue(record.inputJson, `${path}.inputJson`),
    inputHash: stringValue(record.inputHash, `${path}.inputHash`),
    idempotencyKey: stringValue(record.idempotencyKey, `${path}.idempotencyKey`),
    progress: {
      completed: numberValue(progress.completed, `${path}.progress.completed`),
      total: numberValue(progress.total, `${path}.progress.total`),
      message: stringValue(progress.message, `${path}.progress.message`),
    },
    attempts: integerValue(record.attempts, `${path}.attempts`),
    maxAttempts: integerValue(record.maxAttempts, `${path}.maxAttempts`),
    workerId: optionalValue(record.workerId, `${path}.workerId`, stringValue),
    lockedAt: optionalValue(record.lockedAt, `${path}.lockedAt`, dateValue),
    heartbeatAt: optionalValue(record.heartbeatAt, `${path}.heartbeatAt`, dateValue),
    lockExpiresAt: optionalValue(record.lockExpiresAt, `${path}.lockExpiresAt`, dateValue),
    startedAt: optionalValue(record.startedAt, `${path}.startedAt`, dateValue),
    finishedAt: optionalValue(record.finishedAt, `${path}.finishedAt`, dateValue),
    cancellationRequestedAt: optionalValue(record.cancellationRequestedAt, `${path}.cancellationRequestedAt`, dateValue),
    resultSummary: record.resultSummary === undefined
      ? undefined
      : jsonValue(record.resultSummary, `${path}.resultSummary`),
    sanitizedError: optionalValue(record.sanitizedError, `${path}.sanitizedError`, errorValue),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
  };
};
