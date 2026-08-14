import type { Position } from "../../../config/league.js";

const allPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

const positionForSlot = (slot: string): Position | null => {
  if (slot === "QB") return "QB";
  if (slot === "RB") return "RB";
  if (slot === "WR") return "WR";
  if (slot === "TE") return "TE";
  if (slot === "K") return "K";
  if (slot === "DST") return "DST";
  return null;
};

export const eligiblePositionsForSlot = (slot: string): readonly Position[] => {
  if (slot === "FLEX" || slot === "RB_WR_TE") return ["RB", "WR", "TE"];
  if (slot === "RB_WR") return ["RB", "WR"];
  if (slot === "WR_TE") return ["WR", "TE"];
  if (slot === "OP" || slot === "SUPERFLEX") return ["QB", "RB", "WR", "TE"];
  if (slot === "BENCH" || slot === "IR") return allPositions;
  const position = positionForSlot(slot);
  return position === null ? allPositions : [position];
};
