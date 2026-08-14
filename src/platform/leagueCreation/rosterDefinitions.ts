import type { Position } from "../../../config/league.js";

export interface RosterSlotDefinition {
  canonicalSlot: string;
  draftable: boolean;
  eligiblePositions: readonly Position[];
}

const allPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
const offensivePositions: readonly Position[] = ["QB", "RB", "WR", "TE"];

export const rosterSlotDefinitions: Readonly<Record<string, RosterSlotDefinition>> = {
  QB: { canonicalSlot: "QB", draftable: true, eligiblePositions: ["QB"] },
  RB: { canonicalSlot: "RB", draftable: true, eligiblePositions: ["RB"] },
  WR: { canonicalSlot: "WR", draftable: true, eligiblePositions: ["WR"] },
  TE: { canonicalSlot: "TE", draftable: true, eligiblePositions: ["TE"] },
  K: { canonicalSlot: "K", draftable: true, eligiblePositions: ["K"] },
  DST: { canonicalSlot: "DST", draftable: true, eligiblePositions: ["DST"] },
  D_ST: { canonicalSlot: "DST", draftable: true, eligiblePositions: ["DST"] },
  FLEX: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  RB_WR_TE: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  W_R_T: { canonicalSlot: "FLEX", draftable: true, eligiblePositions: ["RB", "WR", "TE"] },
  RB_WR: { canonicalSlot: "RB_WR", draftable: true, eligiblePositions: ["RB", "WR"] },
  R_W: { canonicalSlot: "RB_WR", draftable: true, eligiblePositions: ["RB", "WR"] },
  WR_TE: { canonicalSlot: "WR_TE", draftable: true, eligiblePositions: ["WR", "TE"] },
  W_T: { canonicalSlot: "WR_TE", draftable: true, eligiblePositions: ["WR", "TE"] },
  OP: { canonicalSlot: "OP", draftable: true, eligiblePositions: offensivePositions },
  SUPERFLEX: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  SUPER_FLEX: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  Q_W_R_T: { canonicalSlot: "SUPERFLEX", draftable: true, eligiblePositions: offensivePositions },
  BENCH: { canonicalSlot: "BENCH", draftable: true, eligiblePositions: allPositions },
  BE: { canonicalSlot: "BENCH", draftable: true, eligiblePositions: allPositions },
  IR: { canonicalSlot: "IR", draftable: false, eligiblePositions: [] },
  RESERVE: { canonicalSlot: "IR", draftable: false, eligiblePositions: [] },
};

export const normalizedRosterSlotKey = (slot: string): string =>
  slot.trim().toUpperCase().replace(/[^A-Z0-9]+/gu, "_").replace(/^_+|_+$/gu, "");
