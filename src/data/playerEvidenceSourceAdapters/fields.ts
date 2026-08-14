import {
  factualPlayerContextCategories,
  type FactualPlayerContextCategory,
  type PlayerContextEvidence,
} from "../../../config/playerContext.js";

const evidenceCategorySet = new Set<string>(factualPlayerContextCategories);

const isEvidenceCategory = (value: string): value is FactualPlayerContextCategory =>
  evidenceCategorySet.has(value);

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const stringField = (value: unknown, field: string, player = "evidence row"): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }
  return value.trim();
};

const numberField = (value: unknown, field: string, player: string): number => {
  if (value === undefined || (typeof value === "string" && value.trim() === "")) {
    throw new Error(`Player evidence rows for ${player} must include ${field}.`);
  }
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  return parsed;
};

const confidenceField = (value: unknown, player: string): number => {
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
  if (typeof value !== "string") throw new Error(`Invalid ${field} for ${player}: "${String(value)}".`);
  return value.trim();
};

export const evidenceForRecord = (value: Record<string, unknown>): PlayerContextEvidence => {
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
    player, category, score, confidence, adjustedSignal: score * confidence, source, note,
    ...(provider ? { provider } : {}),
    ...(sourceDate ? { sourceDate } : {}),
    ...(sourceQuality ? { sourceQuality } : {}),
  };
};
