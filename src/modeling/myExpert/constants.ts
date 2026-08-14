import type { Position } from "../../../config/league.js";
import type { MyExpertReadOnlyPolicy } from "./contracts.js";

export const readOnlyPolicy: MyExpertReadOnlyPolicy = {
  mode: "read-only",
  allowedActions: ["recommend"],
  blockedActions: ["add", "drop", "trade", "set-lineup", "submit-waiver-claim"],
};

export const lineupPositionOrder: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
export const flexEligiblePositions = new Set<Position>(["RB", "WR", "TE"]);
export const minimumFlexCandidatesForAdvice = 2;
export const highLineupEdge = 4;
export const mediumLineupEdge = 1.5;
export const defaultPositiveNewsSeverity = 1;
export const defaultWatchNewsSeverity = 2;
export const defaultNegativeNewsSeverity = 3;
