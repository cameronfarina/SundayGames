import {
  type FactualPlayerContextCategory,
  factualPlayerContextCategories,
} from "../../../config/playerContext.js";
import type { SanityFlagKey } from "../topPlayerSanity.js";
import type { PlayerEvidenceQueuePriority } from "./contracts.js";

export const categoriesByFlag: Record<SanityFlagKey, readonly FactualPlayerContextCategory[]> = {
  highMockPremium: ["opportunity", "defensiveAttention", "environment"],
  largeProjectionRankLift: ["opportunity", "defensiveAttention", "skillFit"],
  missingFactualEvidence: [...factualPlayerContextCategories],
  contextPenalty: ["risk", "environment"],
  hardCeilingPressure: ["opportunity", "skillFit", "risk"],
};

export const promptByCategory: Record<FactualPlayerContextCategory, string> = {
  opportunity: "Opportunity: Validate role, routes/targets/touches, and whether the Weeks 1-4 projection is sustainable.",
  defensiveAttention: "Defensive attention: Check whether the player is gaining or losing true No. 1 defensive attention.",
  skillFit: "Skill fit: Compare separation, efficiency, explosive-play, or usage traits against the projected role.",
  environment: "Environment: Check team, quarterback, coordinator, pace, pass rate, and scoring-context changes.",
  risk: "Risk: Check injury, suspension, contract, holdout, age, and role-volatility downside.",
};

export const priorityScore: Record<PlayerEvidenceQueuePriority, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

export const categoryOrder = new Map(
  factualPlayerContextCategories.map((category, index) => [category, index]),
);
