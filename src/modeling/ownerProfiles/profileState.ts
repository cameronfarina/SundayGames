import type { Position } from "../../../config/league.js";
import type { ProfilePositionSpend } from "./contracts.js";

export const emptyProfileSpend = (): ProfilePositionSpend => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
});

export const emptyRosterCounts = (): Record<Position, number> => ({
  QB: 0,
  RB: 0,
  WR: 0,
  TE: 0,
  K: 0,
  DST: 0,
});
