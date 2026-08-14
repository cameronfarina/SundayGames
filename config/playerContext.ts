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

export const playerContextCategories: readonly PlayerContextCategory[] = [
  "role",
  "injury",
  "contract",
  "coaching",
  "schedule",
  "bye",
  "opportunity",
  "defensiveAttention",
  "skillFit",
  "environment",
  "risk",
];

export type FactualPlayerContextCategory =
  | "opportunity"
  | "defensiveAttention"
  | "skillFit"
  | "environment"
  | "risk";

export const factualPlayerContextCategories: readonly FactualPlayerContextCategory[] = [
  "opportunity",
  "defensiveAttention",
  "skillFit",
  "environment",
  "risk",
];
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

export const defaultPlayerContextWeights: PlayerContextWeights = {
  role: 0.08,
  injury: 0.07,
  contract: 0.03,
  coaching: 0.04,
  schedule: 0.03,
  bye: 0.02,
  opportunity: 0.05,
  defensiveAttention: 0.06,
  skillFit: 0.05,
  environment: 0.06,
  risk: 0.07,
};

const playerContextOverrides: readonly PlayerContextOverride[] = [
  {
    player: "Jadarian Price",
    signals: {
      role: -1.5,
      injury: -0.5,
    },
    notes: {
      role: "Temporary opportunity concern tied to Zach Charbonnet's recovery.",
      injury: "Opportunity is injury-contingent rather than fully durable.",
    },
  },
  {
    player: "Bhayshul Tuten",
    signals: {
      role: -0.75,
    },
    notes: {
      role: "Role expansion is plausible but workload is not yet fully established.",
    },
  },
  {
    player: "TreVeyon Henderson",
    signals: {
      role: -0.5,
    },
    notes: {
      role: "Modeled as part of a tandem rather than a solo backfield.",
    },
  },
  {
    player: "Rico Dowdle",
    signals: {
      role: -1,
    },
    notes: {
      role: "Committee-sensitive workload.",
    },
  },
  {
    player: "Christian Watson",
    signals: {
      injury: -0.75,
      role: -0.25,
    },
    notes: {
      injury: "Availability volatility adjustment.",
      role: "Target-volume volatility adjustment.",
    },
  },
  {
    player: "Harold Fannin Jr.",
    signals: {
      role: -1,
    },
    notes: {
      role: "Early-career tight end role uncertainty.",
    },
  },
  {
    player: "Jordyn Tyson",
    signals: {
      role: -1,
    },
    notes: {
      role: "Projection-driven role is not fully established.",
    },
  },
  {
    player: "J.K. Dobbins",
    signals: {
      injury: -1,
      role: -0.5,
    },
    notes: {
      injury: "Durability risk.",
      role: "Backfield-role risk.",
    },
  },
  {
    player: "Kenny Gainwell",
    signals: {
      role: -1.25,
    },
    notes: {
      role: "Projection spike is role-sensitive behind Bucky Irving.",
    },
  },
  {
    player: "Tucker Kraft",
    signals: {
      injury: -1.25,
    },
    notes: {
      injury: "ACL recovery and early-season availability risk.",
    },
  },
];

export const defaultPlayerContextConfig: PlayerContextConfig = {
  enabled: false,
  weights: defaultPlayerContextWeights,
  maxAdjustment: 0.18,
  maxPositiveAdjustment: 0.04,
  maxNegativeAdjustment: 0.18,
  overrides: playerContextOverrides,
};

export const customWeightsPlayerContextConfig: PlayerContextConfig = {
  ...defaultPlayerContextConfig,
  enabled: true,
};
