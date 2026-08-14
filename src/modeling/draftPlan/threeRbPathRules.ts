import type { ThreeRbPathRules } from "./internalContracts.js";

export const threeRbPathRules: ThreeRbPathRules = {
  rbCoreBudget: {
    targetCount: 3,
    minimumSpend: 130,
    hardBudget: 158,
    minimumFutureCorePrice: 14,
  },
  priceBands: [
    {
      slot: "RB1",
      position: "RB",
      minimumPrice: 50,
      maximumPrice: 76,
      note: "Anchor RB lane; can flex up when the board makes it worth it.",
    },
    {
      slot: "RB2",
      position: "RB",
      minimumPrice: 35,
      maximumPrice: 76,
      note: "Second core RB lane, balanced against total RB spend.",
    },
    {
      slot: "RB3",
      position: "RB",
      minimumPrice: 12,
      maximumPrice: 48,
      note: "Third playable RB lane; price flexes down after expensive anchors.",
    },
    {
      slot: "WR1",
      position: "WR",
      minimumPrice: 12,
      maximumPrice: 26,
      note: "Paid WR value starter.",
    },
    {
      slot: "WR2",
      position: "WR",
      minimumPrice: 8,
      maximumPrice: 20,
      note: "Second WR value starter.",
    },
    {
      slot: "TE",
      position: "TE",
      minimumPrice: 1,
      maximumPrice: 4,
      note: "Cheap TE lane.",
    },
  ],
  slotMaxBids: {
    RB: [76, 76, 76, 8, 4],
    WR: [26, 20, 16, 8, 5, 3, 1],
    TE: [4, 1],
    K: [2],
    DST: [2],
  },
  pivotRules: [
    {
      label: "RB budget envelope",
      trigger: "The first two RBs use most of the RB core budget.",
      action: "Let the third RB flex down and protect paid WR value instead of forcing another premium RB.",
    },
    {
      label: "Third RB chase",
      trigger: "The third RB would push the core above the hard RB budget.",
      action: "Pass unless the player is a clear projection value and the WR plan is already intact.",
    },
    {
      label: "WR pocket closes",
      trigger: "WR starters are clearing above the value pocket.",
      action: "Preserve the RB core and force TE/K/DST into the $1-$3 lane.",
    },
  ],
};
