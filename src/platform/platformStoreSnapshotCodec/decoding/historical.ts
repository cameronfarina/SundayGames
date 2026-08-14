import type {
  HistoricalImportBatch,
  HistoricalImportIdentityAudit,
  HistoricalImportRowPreview,
  HistoricalSaleRecord,
} from "../../historicalImports.js";
import { issueValue, ownerCandidateValue } from "./historicalIssues.js";
import { optionalString, positionValue } from "./leaguePrimitives.js";
import {
  arrayValue,
  booleanValue,
  dateValue,
  integerValue,
  invalidSnapshot,
  numberValue,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const identityAuditValue = (value: unknown, path: string): HistoricalImportIdentityAudit => {
  const record = recordValue(value, path);
  const resolution = record.resolution;
  if (resolution !== "exact" && resolution !== "explicit" && resolution !== "fuzzy"
    && resolution !== "ambiguous" && resolution !== "unresolved") {
    return invalidSnapshot(`${path}.resolution`);
  }
  const mappedTeamId = optionalString(record.mappedTeamId, `${path}.mappedTeamId`);
  const mappedOwner = optionalString(
    record.mappedCurrentOwnerDisplayName,
    `${path}.mappedCurrentOwnerDisplayName`,
  );
  const mappedTeam = optionalString(
    record.mappedCurrentTeamDisplayName,
    `${path}.mappedCurrentTeamDisplayName`,
  );
  const candidates = optionalValue(record.candidates, `${path}.candidates`, (candidate, candidatePath) =>
    arrayValue(candidate, candidatePath, ownerCandidateValue));
  return {
    sourceOwnerOrTeamLabel: stringValue(record.sourceOwnerOrTeamLabel, `${path}.sourceOwnerOrTeamLabel`),
    resolution,
    ...(mappedTeamId === undefined ? {} : { mappedTeamId }),
    ...(mappedOwner === undefined ? {} : { mappedCurrentOwnerDisplayName: mappedOwner }),
    ...(mappedTeam === undefined ? {} : { mappedCurrentTeamDisplayName: mappedTeam }),
    ...(candidates === undefined ? {} : { candidates }),
  };
};

export const historicalSaleValue = (value: unknown, path: string): HistoricalSaleRecord => {
  const record = recordValue(value, path);
  const acquisitionType = record.acquisitionType;
  if (acquisitionType !== "auction" && acquisitionType !== "keeper") {
    return invalidSnapshot(`${path}.acquisitionType`);
  }
  const publicPriceDollars = optionalValue(
    record.publicPriceDollars,
    `${path}.publicPriceDollars`,
    numberValue,
  );
  return {
    id: stringValue(record.id, `${path}.id`),
    batchId: stringValue(record.batchId, `${path}.batchId`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    leagueSeasonId: stringValue(record.leagueSeasonId, `${path}.leagueSeasonId`),
    seasonYear: integerValue(record.seasonYear, `${path}.seasonYear`),
    rowNumber: integerValue(record.rowNumber, `${path}.rowNumber`),
    ownerId: stringValue(record.ownerId, `${path}.ownerId`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
    playerId: stringValue(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: positionValue(record.position, `${path}.position`),
    priceDollars: numberValue(record.priceDollars, `${path}.priceDollars`),
    ...(publicPriceDollars === undefined ? {} : { publicPriceDollars }),
    keeper: booleanValue(record.keeper, `${path}.keeper`),
    acquisitionType,
  };
};

const rowPreviewValue = (value: unknown, path: string): HistoricalImportRowPreview => {
  const record = recordValue(value, path);
  const status = record.status;
  if (status !== "ready" && status !== "blocked") return invalidSnapshot(`${path}.status`);
  const identityAudit = optionalValue(
    record.identityAudit,
    `${path}.identityAudit`,
    identityAuditValue,
  );
  return {
    rowNumber: integerValue(record.rowNumber, `${path}.rowNumber`),
    status,
    blockers: arrayValue(record.blockers, `${path}.blockers`, issueValue),
    warnings: arrayValue(record.warnings, `${path}.warnings`, issueValue),
    record: record.record === null ? null : historicalSaleValue(record.record, `${path}.record`),
    ...(identityAudit === undefined ? {} : { identityAudit }),
  };
};

export const historicalBatchValue = (value: unknown, path: string): HistoricalImportBatch => {
  const record = recordValue(value, path);
  const status = record.status;
  if (status !== "previewed" && status !== "blocked" && status !== "committed"
    && status !== "superseded") return invalidSnapshot(`${path}.status`);
  const uploadedByUserId = optionalString(record.uploadedByUserId, `${path}.uploadedByUserId`);
  const committedAt = optionalValue(record.committedAt, `${path}.committedAt`, dateValue);
  const supersededAt = optionalValue(record.supersededAt, `${path}.supersededAt`, dateValue);
  const supersededByBatchId = optionalString(
    record.supersededByBatchId,
    `${path}.supersededByBatchId`,
  );
  return {
    id: stringValue(record.id, `${path}.id`),
    leagueId: stringValue(record.leagueId, `${path}.leagueId`),
    leagueSeasonId: record.leagueSeasonId === null ? null : stringValue(record.leagueSeasonId, `${path}.leagueSeasonId`),
    seasonYear: integerValue(record.seasonYear, `${path}.seasonYear`),
    fileHash: stringValue(record.fileHash, `${path}.fileHash`),
    ...(uploadedByUserId === undefined ? {} : { uploadedByUserId }),
    status,
    replacementRequested: booleanValue(record.replacementRequested, `${path}.replacementRequested`),
    createdAt: dateValue(record.createdAt, `${path}.createdAt`),
    ...(committedAt === undefined ? {} : { committedAt }),
    ...(supersededAt === undefined ? {} : { supersededAt }),
    ...(supersededByBatchId === undefined ? {} : { supersededByBatchId }),
    blockers: arrayValue(record.blockers, `${path}.blockers`, issueValue),
    warnings: arrayValue(record.warnings, `${path}.warnings`, issueValue),
    rows: arrayValue(record.rows, `${path}.rows`, rowPreviewValue),
  };
};
