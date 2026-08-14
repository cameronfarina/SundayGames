import type { StrategyPlanRule } from "../internalContracts.js";

export const wrHeavyStrategyRules: StrategyPlanRule = {
  priceBands: [
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 38,
      maximumPrice: 72,
      note: "Primary receiver anchor lane.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 24,
      maximumPrice: 56,
      note: "Second receiver lane for a real weekly edge.",
    },
    {
      slot: "WR3",
      position: "WR",
      minimumPrice: 12,
      maximumPrice: 36,
      note: "Third receiver/flex value pocket.",
    },
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 18,
      maximumPrice: 48,
      note: "Playable RB lane without fighting the elite-RB room.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 6,
      maximumPrice: 28,
      note: "Second RB lane built from price discipline.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 8,
      note: "Cheap TE lane.",
    },
  ],
  pivotRules: [
    {
      label: "Receiver tax",
      trigger: "WR anchors are all clearing at premium RB prices.",
      action: "Take the RB discount and turn the build back toward balanced instead of paying for the logo.",
    },
    {
      label: "RB scarcity spike",
      trigger: "The room is letting every playable RB disappear.",
      action: "Buy one RB starter before adding the third receiver.",
    },
  ],
};
