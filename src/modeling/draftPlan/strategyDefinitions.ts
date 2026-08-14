import type {
  DraftPlanStrategyDefinition,
  DraftPlanStrategyKey,
} from "./contracts.js";
import { threeRbPathRules } from "./threeRbPathRules.js";

export const draftPlanStrategies: Record<DraftPlanStrategyKey, DraftPlanStrategyDefinition> = {
  balanced: {
    key: "balanced",
    label: "Balanced",
    thresholds: {
      rb1Minimum: 20,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 40,
    },
  },
  "three-rb": {
    key: "three-rb",
    label: "True 3RB",
    thresholds: {
      rb1Minimum: threeRbPathRules.priceBands[0]?.minimumPrice ?? 50,
      rb2Minimum: threeRbPathRules.priceBands[1]?.minimumPrice ?? 35,
      rb3Minimum: threeRbPathRules.priceBands[2]?.minimumPrice ?? 12,
      rbCoreSpendMinimum: threeRbPathRules.rbCoreBudget.minimumSpend,
    },
  },
  "hero-rb": {
    key: "hero-rb",
    label: "Hero RB",
    thresholds: {
      rb1Minimum: 45,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 65,
    },
  },
  "wr-heavy": {
    key: "wr-heavy",
    label: "WR Heavy",
    thresholds: {
      rb1Minimum: 1,
      rb2Minimum: 1,
      rb3Minimum: 0,
      rbCoreSpendMinimum: 24,
    },
  },
};
