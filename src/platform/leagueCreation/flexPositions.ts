import type { Position } from "../../../config/league.js";
import { analyzeRosterSlots } from "./roster.js";

const positionOrder: readonly Position[] = ["QB", "RB", "WR", "TE", "K", "DST"];
const benchSlot = "BENCH";

/**
 * Positions a league's flexible starting slots accept. A standard FLEX takes a
 * running back, receiver, or tight end; a superflex adds the quarterback. The
 * bench accepts everything without being a starting slot, so it never counts.
 */
export const flexEligiblePositions = (
  lineup: Readonly<Record<string, number>>,
): readonly Position[] => {
  const eligible = new Set<Position>();

  for (const slot of analyzeRosterSlots(lineup).draftableSlots) {
    if (slot.slot === benchSlot || slot.eligiblePositions.length < 2) continue;
    for (const position of slot.eligiblePositions) eligible.add(position);
  }

  return positionOrder.filter(position => eligible.has(position));
};
