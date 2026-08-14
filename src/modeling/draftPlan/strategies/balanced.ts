import type { StrategyPlanRule } from "../internalContracts.js";

export const balancedStrategyRules: StrategyPlanRule = {
  priceBands: [
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 35,
      maximumPrice: 68,
      note: "Lead RB lane without locking into three premium backs.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 18,
      maximumPrice: 48,
      note: "Second RB lane that protects starter quality.",
    },
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 20,
      maximumPrice: 52,
      note: "Paid WR lane when value beats forcing another RB.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 8,
      maximumPrice: 28,
      note: "Second WR starter value pocket.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 8,
      note: "Controlled TE lane unless the board creates a discount.",
    },
  ],
  pivotRules: [
    {
      label: "Take the discount",
      trigger: "A starter at RB or WR falls below live value.",
      action: "Buy the discount and rebalance the next starter slot instead of staying rigid by position.",
    },
    {
      label: "Avoid double panic",
      trigger: "Two premium rooms clear above your value in a row.",
      action: "Let one tier go and spend into the next RB/WR pocket with a firm max.",
    },
  ],
};
