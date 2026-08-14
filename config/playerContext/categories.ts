import type {
  FactualPlayerContextCategory,
  PlayerContextCategory,
} from "./contracts.js";

export const playerContextCategories: readonly PlayerContextCategory[] = [
  "role", "injury", "contract", "coaching", "schedule", "bye", "opportunity",
  "defensiveAttention", "skillFit", "environment", "risk",
];

export const factualPlayerContextCategories: readonly FactualPlayerContextCategory[] = [
  "opportunity", "defensiveAttention", "skillFit", "environment", "risk",
];
