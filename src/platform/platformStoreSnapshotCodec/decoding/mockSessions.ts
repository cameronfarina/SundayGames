import type {
  MockDraftCommand,
  MockDraftFormat,
  MockDraftMetadataValue,
  MockDraftModeMetadata,
  MockDraftResultReference,
  MockDraftSession,
  MockDraftSessionStatus,
} from "../../mockSessions.js";
import { normalizePersistedMockDraftSession } from "../../mockSessions.js";
import { normalizeSeasonMockConfigurationSnapshot } from "../../seasonMockSnapshot.js";
import { optionalString } from "./leaguePrimitives.js";
import {
  arrayValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const metadataValue = (value: unknown, path: string): MockDraftMetadataValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return numberValue(value, path);
  if (Array.isArray(value)) {
    return value.map((item, index) => metadataValue(item, `${path}[${index}]`));
  }
  const record = recordValue(value, path);
  const result: Record<string, MockDraftMetadataValue> = {};
  for (const [key, child] of Object.entries(record)) {
    result[key] = metadataValue(child, `${path}.${key}`);
  }
  return result;
};

const formatValue = (value: unknown, path: string): MockDraftFormat => {
  if (value === "auction" || value === "snake") return value;
  return invalidSnapshot(path);
};

const modeValue = (value: unknown, path: string): MockDraftModeMetadata => {
  const record = recordValue(value, path);
  const label = optionalString(record.label, `${path}.label`);
  const settings = optionalValue(record.settings, `${path}.settings`, (candidate, candidatePath) => {
    const source = recordValue(candidate, candidatePath);
    const decoded: Record<string, MockDraftMetadataValue> = {};
    for (const [key, child] of Object.entries(source)) {
      decoded[key] = metadataValue(child, `${candidatePath}.${key}`);
    }
    return decoded;
  });
  return {
    format: formatValue(record.format, `${path}.format`),
    mockCount: integerValue(record.mockCount, `${path}.mockCount`),
    ...(label === undefined ? {} : { label }),
    ...(settings === undefined ? {} : { settings }),
  };
};

const resultReferenceValue = (value: unknown, path: string): MockDraftResultReference => {
  const record = recordValue(value, path);
  if (record.kind !== "mock-result" && record.kind !== "simulation-result") {
    return invalidSnapshot(`${path}.kind`);
  }
  const label = optionalString(record.label, `${path}.label`);
  return {
    id: stringValue(record.id, `${path}.id`),
    kind: record.kind,
    ...(label === undefined ? {} : { label }),
  };
};

const commandValue = (value: unknown, path: string): MockDraftCommand => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    idempotencyKey: stringValue(record.idempotencyKey, `${path}.idempotencyKey`),
    command: stringValue(record.command, `${path}.command`),
    revision: integerValue(record.revision, `${path}.revision`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
  };
};

const statusValue = (value: unknown, path: string): MockDraftSessionStatus => {
  if (value === "setup" || value === "active" || value === "completed" || value === "abandoned") {
    return value;
  }
  return invalidSnapshot(path);
};

export const mockSessionValue = (value: unknown, path: string): MockDraftSession => {
  const record = recordValue(value, path);
  const configurationSnapshot = normalizeSeasonMockConfigurationSnapshot(
    record.configurationSnapshot,
  );
  return normalizePersistedMockDraftSession({
    id: stringValue(record.id, `${path}.id`),
    userId: stringValue(record.userId, `${path}.userId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    teamId: stringValue(record.teamId, `${path}.teamId`),
    status: statusValue(record.status, `${path}.status`),
    draftMode: modeValue(record.draftMode, `${path}.draftMode`),
    configurationSnapshot,
    revision: integerValue(record.revision, `${path}.revision`),
    commandLog: arrayValue(record.commandLog, `${path}.commandLog`, commandValue),
    latestResultRef: optionalValue(record.latestResultRef, `${path}.latestResultRef`, resultReferenceValue),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
    startedAt: optionalValue(record.startedAt, `${path}.startedAt`, dateValue),
    completedAt: optionalValue(record.completedAt, `${path}.completedAt`, dateValue),
    abandonedAt: optionalValue(record.abandonedAt, `${path}.abandonedAt`, dateValue),
  });
};
