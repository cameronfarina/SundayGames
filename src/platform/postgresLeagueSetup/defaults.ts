import type { Position } from "../../../config/league.js";
import type {
  KeeperPolicy,
  LineupSettings,
  RosterMaximums,
} from "../leagueSeason.js";

export const positions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];

export const defaultKeeperPolicy: KeeperPolicy = {
  mode: "previous-cost-multiplier",
  multiplier: 1.2,
  rounding: "ceil",
};

export const defaultLineup: LineupSettings = {
  QB: 1,
  RB: 2,
  WR: 2,
  TE: 1,
  FLEX: 1,
  K: 1,
  DST: 1,
  BENCH: 7,
};

export const defaultRosterMaximums: RosterMaximums = {
  QB: 4,
  RB: 8,
  WR: 8,
  TE: 4,
  K: 2,
  DST: 2,
};
