import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import { parseCsvRecords, type CsvRow } from "../playerContextImports.js";
import { evidenceForRecord } from "./fields.js";

const optionalPayloadFields: readonly string[] = [
  "score", "confidence", "source", "note", "provider", "source_date", "sourceDate",
  "source_quality", "sourceQuality",
];
const requiredPayloadFields: readonly string[] = ["score", "source", "note"];

const isBlankValue = (value: unknown): boolean =>
  value === undefined || (typeof value === "string" && value.trim() === "");

const shouldSkipUntouchedRow = (row: CsvRow): boolean => {
  if (!optionalPayloadFields.some(field => !isBlankValue(row[field]))) return true;
  const missingFields = requiredPayloadFields.filter(field => isBlankValue(row[field]));
  if (missingFields.length === 0) return false;
  const player = row.player?.trim() || "evidence row";
  throw new Error(
    `Incomplete player evidence row for ${player}: ${missingFields.join(", ")} missing. ` +
    "Fill score, source, and note together, or leave score, confidence, source, and note blank to skip the row.",
  );
};

export const parseScoredLocalCsv = (content: string): PlayerContextEvidence[] =>
  parseCsvRecords(content).flatMap(row =>
    shouldSkipUntouchedRow(row) ? [] : [evidenceForRecord(row)],
  );
