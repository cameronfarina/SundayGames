import type { PlayerContextEvidence } from "../../../config/playerContext.js";
import { evidenceForRecord, isRecord } from "./fields.js";

const evidenceValuesFromJson = (parsed: unknown): unknown[] => {
  if (Array.isArray(parsed)) return parsed;
  if (isRecord(parsed) && Array.isArray(parsed.evidence)) return parsed.evidence;
  throw new Error("Player evidence JSON must be an evidence array or an object with an evidence array.");
};

export const parseScoredLocalJson = (content: string): PlayerContextEvidence[] => {
  const parsed: unknown = JSON.parse(content);
  return evidenceValuesFromJson(parsed).map(value => {
    if (!isRecord(value)) throw new Error("Player evidence JSON rows must be objects.");
    return evidenceForRecord(value);
  });
};
