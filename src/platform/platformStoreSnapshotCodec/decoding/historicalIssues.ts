import type {
  HistoricalImportIssue,
  HistoricalImportIssueCode,
  HistoricalImportIssueSeverity,
  HistoricalImportReviewCandidate,
  HistoricalOwnerResolutionCandidate,
} from "../../historicalImports.js";
import { optionalString } from "./leaguePrimitives.js";
import {
  arrayValue,
  integerValue,
  invalidSnapshot,
  optionalValue,
  recordValue,
  stringValue,
} from "./primitives.js";

const issueCodeValue = (value: unknown, path: string): HistoricalImportIssueCode => {
  const candidate = stringValue(value, path);
  if (candidate === "season_missing" || candidate === "team_count_mismatch"
    || candidate === "owner_unknown" || candidate === "owner_ambiguous"
    || candidate === "owner_mapping_not_one_to_one" || candidate === "owner_fuzzy_match"
    || candidate === "owner_unmapped"
    || candidate === "position_invalid" || candidate === "player_missing"
    || candidate === "price_invalid" || candidate === "public_price_invalid"
    || candidate === "player_duplicate" || candidate === "player_ambiguous"
    || candidate === "player_unresolved" || candidate === "player_historical_only"
    || candidate === "season_spend_mismatch" || candidate === "keeper_inferred"
    || candidate === "acquisition_type_inferred") return candidate;
  return invalidSnapshot(path);
};

const severityValue = (value: unknown, path: string): HistoricalImportIssueSeverity => {
  if (value === "blocker" || value === "warning") return value;
  return invalidSnapshot(path);
};

export const ownerCandidateValue = (
  value: unknown,
  path: string,
): HistoricalOwnerResolutionCandidate => {
  const record = recordValue(value, path);
  return {
    teamId: stringValue(record.teamId, `${path}.teamId`),
    teamDisplayName: stringValue(record.teamDisplayName, `${path}.teamDisplayName`),
    ownerDisplayName: stringValue(record.ownerDisplayName, `${path}.ownerDisplayName`),
  };
};

const reviewCandidateValue = (value: unknown, path: string): HistoricalImportReviewCandidate => {
  const record = recordValue(value, path);
  if (typeof record.teamId === "string") return ownerCandidateValue(record, path);
  return {
    playerId: stringValue(record.playerId, `${path}.playerId`),
    playerName: stringValue(record.playerName, `${path}.playerName`),
    position: stringValue(record.position, `${path}.position`),
  };
};

export const issueValue = (value: unknown, path: string): HistoricalImportIssue => {
  const record = recordValue(value, path);
  const rowNumber = optionalValue(record.rowNumber, `${path}.rowNumber`, integerValue);
  const sourceValue = optionalString(record.sourceValue, `${path}.sourceValue`);
  const candidates = optionalValue(record.candidates, `${path}.candidates`, (candidate, candidatePath) =>
    arrayValue(candidate, candidatePath, reviewCandidateValue));
  return {
    code: issueCodeValue(record.code, `${path}.code`),
    severity: severityValue(record.severity, `${path}.severity`),
    message: stringValue(record.message, `${path}.message`),
    ...(rowNumber === undefined ? {} : { rowNumber }),
    ...(sourceValue === undefined ? {} : { sourceValue }),
    ...(candidates === undefined ? {} : { candidates }),
  };
};
