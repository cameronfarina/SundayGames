import type {
  FactualPlayerContextCategory,
  PlayerContextEvidence,
} from "../../../config/playerContext.js";
import type { SanityFlagKey } from "../topPlayerSanity.js";

export type PlayerEvidenceQueuePriority = "high" | "medium" | "low";
export type PlayerEvidenceStatus = "missing" | "partial" | "present";

export interface PlayerEvidenceQueueRow {
  priority: PlayerEvidenceQueuePriority;
  rank: number;
  player: string;
  position: string;
  scenarioPrice: number;
  averageMockSalePrice: number;
  saleVsScenarioPrice: number;
  currentEvidenceCount: number;
  currentEvidence?: readonly PlayerContextEvidence[];
  evidenceStatus: PlayerEvidenceStatus;
  flags: SanityFlagKey[];
  categories: FactualPlayerContextCategory[];
  researchPrompts: string[];
}

export interface PlayerEvidenceQueueSummary {
  playerCount: number;
  highPriorityCount: number;
  mediumPriorityCount: number;
  lowPriorityCount: number;
  categoryCounts: Partial<Record<FactualPlayerContextCategory, number>>;
}

export interface PlayerEvidenceQueue {
  summary: PlayerEvidenceQueueSummary;
  rows: PlayerEvidenceQueueRow[];
}
