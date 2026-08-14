import type { ExportArtifact, ExportArtifactContent } from "../../exportArtifacts.js";
import type { PracticeShortlistItem } from "../../practiceShortlists.js";
import {
  dateValue,
  integerValue,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

export const shortlistItemValue = (value: unknown, path: string): PracticeShortlistItem => {
  const record = recordValue(value, path);
  return {
    id: stringValue(record.id, `${path}.id`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    userId: stringValue(record.userId, `${path}.userId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: stringValue(record.position, `${path}.position`),
    maxBid: optionalValue(record.maxBid, `${path}.maxBid`, numberValue),
    priority: numberValue(record.priority, `${path}.priority`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    updatedAt: dateValue(record.updatedAt, `${path}.updatedAt`),
  };
};

export const exportArtifactValue = (value: unknown, path: string): ExportArtifact => {
  const record = recordValue(value, path);
  if (record.format !== "csv") throw new Error(`Invalid platform store snapshot at ${path}.format.`);
  return {
    id: stringValue(record.id, `${path}.id`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    seasonId: stringValue(record.seasonId, `${path}.seasonId`),
    roomId: stringValue(record.roomId, `${path}.roomId`),
    format: record.format,
    sourceRevision: integerValue(record.sourceRevision, `${path}.sourceRevision`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    storageKey: stringValue(record.storageKey, `${path}.storageKey`),
    sha256: stringValue(record.sha256, `${path}.sha256`),
    byteLength: integerValue(record.byteLength, `${path}.byteLength`),
    contentType: stringValue(record.contentType, `${path}.contentType`),
  };
};

export const exportArtifactContentValue = (
  value: unknown,
  path: string,
): ExportArtifactContent => {
  const record = recordValue(value, path);
  return {
    artifactId: stringValue(record.artifactId, `${path}.artifactId`),
    contentBase64: stringValue(record.contentBase64, `${path}.contentBase64`),
  };
};
