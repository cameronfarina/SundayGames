export type PlayerContextCategory =
  | "role"
  | "injury"
  | "contract"
  | "coaching"
  | "schedule"
  | "bye"
  | "opportunity"
  | "defensiveAttention"
  | "skillFit"
  | "environment"
  | "risk";

export type FactualPlayerContextCategory =
  | "opportunity"
  | "defensiveAttention"
  | "skillFit"
  | "environment"
  | "risk";

export type PlayerContextSignals = Partial<Record<PlayerContextCategory, number>>;
export type PlayerContextNotes = Partial<Record<PlayerContextCategory, string>>;
export type PlayerContextWeights = Record<PlayerContextCategory, number>;

export interface PlayerContextEvidence {
  player: string;
  category: FactualPlayerContextCategory;
  score: number;
  confidence: number;
  adjustedSignal: number;
  source?: string;
  note?: string;
  provider?: string;
  sourceDate?: string;
  sourceQuality?: string;
}

export interface PlayerContextOverride {
  player: string;
  signals: PlayerContextSignals;
  notes?: PlayerContextNotes;
  evidence?: readonly PlayerContextEvidence[];
}

export interface PlayerContextConfig {
  enabled: boolean;
  weights: PlayerContextWeights;
  maxAdjustment: number;
  maxPositiveAdjustment?: number;
  maxNegativeAdjustment?: number;
  overrides: readonly PlayerContextOverride[];
}
