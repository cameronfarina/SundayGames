import { primaryOwner, type Owner, type Position } from "../../../config/league.js";
import type { KeeperScenarioKey } from "../keeperInflation.js";
import type { LiveDraftRosterSlotKey } from "./contracts.js";

export const defaultScenarioKey: KeeperScenarioKey = "expected";
export const defaultWatchOwner: Owner = primaryOwner;
export const defaultTargetLimit = 80;
export const compactWordPattern = /[^a-z0-9]+/g;

export const lineupSlotKeys: readonly LiveDraftRosterSlotKey[] = [
  "QB", "RB1", "RB2", "WR1", "WR2", "TE", "FLEX", "K", "DST",
  "BENCH1", "BENCH2", "BENCH3", "BENCH4", "BENCH5", "BENCH6", "BENCH7",
];

export const flexEligiblePositions: readonly Position[] = ["RB", "WR", "TE"];
export const allPositions: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
export const skillPositions: readonly ("RB" | "WR" | "TE")[] = ["RB", "WR", "TE"];
