import type { StrategyPlanRules } from "./internalContracts.js";
import { balancedStrategyRules } from "./strategies/balanced.js";
import { heroRbStrategyRules } from "./strategies/heroRb.js";
import { wrHeavyStrategyRules } from "./strategies/wrHeavy.js";
import { threeRbPathRules } from "./threeRbPathRules.js";

export const strategyPlanRules: StrategyPlanRules = {
  balanced: balancedStrategyRules,
  "three-rb": {
    priceBands: threeRbPathRules.priceBands,
    pivotRules: threeRbPathRules.pivotRules,
  },
  "hero-rb": heroRbStrategyRules,
  "wr-heavy": wrHeavyStrategyRules,
};
