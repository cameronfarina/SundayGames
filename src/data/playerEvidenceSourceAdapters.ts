import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import {
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
  type PlayerContextEvidence,
} from "../../config/playerContext.js";
import { parseCsvRecords, type CsvRow } from "./playerContextImports.js";

export type PlayerEvidenceSourceAdapterKey = "scored-local";

export interface LoadPlayerEvidenceSourceRowsOptions {
  path: string;
  adapter?: PlayerEvidenceSourceAdapterKey;
}

type CsvValue = string | number | boolean | undefined;

const evidenceCategorySet = new Set<string>(factualPlayerContextCategories);
const optionalEvidencePayloadFields: readonly string[] = [
  "score",
  "confidence",
  "source",
  "note",
  "provider",
  "source_date",
  "sourceDate",
  "source_quality",
  "sourceQuality",
];
const requiredEvidencePayloadFields: readonly string[] = ["score", "source", "note"];

const isEvidenceCategory = (value: string): value is FactualPlayerContextCategory =>
  evidenceCategorySet.has(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (
  value: unknown,
  field: string,
  player = "evidence row",
): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }

  return value.trim();
};

const numberField = (
  value: unknown,
  field: string,
  player: string,
): number => {
  if (value === undefined || (typeof value === "string" && value.trim() === "")) {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  }

  return parsed;
};

const confidenceField = (
  value: unknown,
  player: string,
): number => {
  if (value === undefined || value === "") return 1;

  const confidence = numberField(value, "confidence", player);
  if (confidence < 0 || confidence > 1) {
    throw new Error(`Player evidence confidence for ${player} must be between 0 and 1.`);
  }

  return confidence;
};

const optionalStringField = (
  value: unknown,
  field: string,
  player: string,
): string | undefined => {
  if (value === undefined || (typeof value === "string" && value.trim() === "")) return undefined;
  if (typeof value !== "string") {
    throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  }

  return value.trim();
};

const evidenceForRecord = (
  value: Record<string, unknown>,
): PlayerContextEvidence => {
  const player = stringField(value.player, "player");
  const category = stringField(value.category, "category", player);
  if (!isEvidenceCategory(category)) {
    throw new Error(`Invalid player evidence category for ${player}: "${category}".`);
  }

  const score = numberField(value.score, "score", player);
  if (score < -2 || score > 2) {
    throw new Error(`Player evidence score for ${player} must be between -2 and 2.`);
  }

  const confidence = confidenceField(value.confidence, player);
  const source = stringField(value.source, "source", player);
  const note = stringField(value.note, "note", player);
  const provider = optionalStringField(value.provider, "provider", player);
  const sourceDate = optionalStringField(value.sourceDate ?? value.source_date, "source_date", player);
  const sourceQuality = optionalStringField(value.sourceQuality ?? value.source_quality, "source_quality", player);

  return {
    player,
    category,
    score,
    confidence,
    adjustedSignal: score * confidence,
    source,
    note,
    ...(provider ? { provider } : {}),
    ...(sourceDate ? { sourceDate } : {}),
    ...(sourceQuality ? { sourceQuality } : {}),
  };
};

const evidenceForCsvRow = (row: CsvRow): PlayerContextEvidence =>
  evidenceForRecord(row);

const isBlankValue = (value: unknown): boolean =>
  value === undefined || (typeof value === "string" && value.trim() === "");

const shouldSkipUntouchedCsvRow = (row: CsvRow): boolean => {
  const hasAnyEvidencePayload = optionalEvidencePayloadFields.some(field => !isBlankValue(row[field]));
  if (!hasAnyEvidencePayload) return true;

  const missingRequiredFields = requiredEvidencePayloadFields.filter(field => isBlankValue(row[field]));
  if (missingRequiredFields.length === 0) return false;

  const player = row.player?.trim() || "evidence row";
  throw new Error(
    `Incomplete player evidence row for ${player}: ${missingRequiredFields.join(", ")} missing. ` +
    "Fill score, source, and note together, or leave score, confidence, source, and note blank to skip the row.",
  );
};

const evidenceValuesFromJson = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.evidence)) {
    return parsed.evidence;
  }

  throw new Error("Player evidence JSON must be an evidence array or an object with an evidence array.");
};

const parseScoredLocalJson = (content: string): PlayerContextEvidence[] => {
  const parsed: unknown = JSON.parse(content);
  return evidenceValuesFromJson(parsed).map(value => {
    if (!isRecord(value)) throw new Error("Player evidence JSON rows must be objects.");
    return evidenceForRecord(value);
  });
};

const parseScoredLocalCsv = (content: string): PlayerContextEvidence[] =>
  parseCsvRecords(content).flatMap(row =>
    shouldSkipUntouchedCsvRow(row) ? [] : [evidenceForCsvRow(row)],
  );

export const loadPlayerEvidenceSourceRows = async ({
  path,
  adapter = "scored-local",
}: LoadPlayerEvidenceSourceRowsOptions): Promise<PlayerContextEvidence[]> => {
  if (adapter !== "scored-local") throw new Error(`Unsupported player evidence source adapter "${adapter}".`);

  const content = await readFile(path, "utf8");
  const extension = extname(path).toLowerCase();
  if (extension === ".csv") return parseScoredLocalCsv(content);
  if (extension === ".json") return parseScoredLocalJson(content);

  throw new Error(`Unsupported player evidence source file extension "${extension}". Use .csv or .json.`);
};

const csvCell = (value: CsvValue): string => {
  const text = value === undefined ? "" : String(value);
  if (!/[",\n]/.test(text)) return text;
  return `"${text.replaceAll("\"", "\"\"")}"`;
};

export const playerContextEvidenceCsv = (
  rows: readonly PlayerContextEvidence[],
): string =>
  [
    "player,category,score,confidence,source,note,provider,source_date,source_quality",
    ...rows.map(row => [
      row.player,
      row.category,
      row.score,
      row.confidence,
      row.source,
      row.note,
      row.provider,
      row.sourceDate,
      row.sourceQuality,
    ].map(csvCell).join(",")),
  ].join("\n");
