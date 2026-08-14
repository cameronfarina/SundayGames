import type { KeeperPolicy, ScoringSettings } from "./contracts.js";

export const defaultSeasonYear = 2026;
export const defaultLeagueName = "Mockd";
export const defaultKeeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};

export const defaultScoringSettings: ScoringSettings = {
  passingYards: 0.04,
  passingTouchdown: 4,
  rushingYards: 0.1,
  rushingTouchdown: 6,
  receivingYards: 0.1,
  receivingTouchdown: 6,
  reception: 0.5,
};

export const calculateKeeperCost = (policy: KeeperPolicy, previousCost: number): number =>
  policy.rounding === "ceil" ? Math.ceil(previousCost * policy.multiplier) : previousCost;
