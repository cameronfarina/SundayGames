import type { StrategyPlanRule } from "../internalContracts.js";

export const heroRbStrategyRules: StrategyPlanRule = {
  priceBands: [
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 48,
      maximumPrice: 72,
      note: "One premium RB anchor, then let RB2 come from value.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 8,
      maximumPrice: 30,
      note: "Discount RB2 lane after the anchor.",
    },
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 28,
      maximumPrice: 60,
      note: "Primary receiver spend after the RB anchor is secured.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 16,
      maximumPrice: 38,
      note: "Second WR starter lane with room for upside.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 8,
      note: "Controlled TE lane unless the anchor/WR spend comes in light.",
    },
  ],
  pivotRules: [
    {
      label: "Anchor RB miss",
      trigger: "The RB anchor tier clears above your max.",
      action: "Do not chase a fake hero build; pivot to balanced RB2/WR spend.",
    },
    {
      label: "WR pocket closes",
      trigger: "WR1 and WR2 both climb above plan.",
      action: "Use RB2 value and keep TE cheap so the roster does not become thin.",
    },
  ],
};
