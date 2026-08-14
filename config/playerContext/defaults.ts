import type { PlayerContextConfig, PlayerContextWeights } from "./contracts.js";
import { playerContextOverrides } from "./overrides.js";

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
