import { ownerOrder, type Owner } from "../../../config/league.js";
import type { AuctionOwnerState } from "../auctionEngine.js";
import type { LiveDraftState, LiveDraftTarget } from "../liveDraft.js";

export const allRostersFull = (
  ownerStates: readonly AuctionOwnerState[],
): boolean => ownerStates.every(state => state.rosterSlotsRemaining <= 0);

export const snakeOwnerForPick = (
  pickIndex: number,
  ownerStates: readonly AuctionOwnerState[],
): { owner: Owner; cursor: number } | undefined => {
  for (let offset = 0; offset < ownerOrder.length * 2; offset += 1) {
    const adjustedPickIndex = pickIndex + offset;
    const round = Math.floor(adjustedPickIndex / ownerOrder.length);
    const slot = adjustedPickIndex % ownerOrder.length;
    const owner = round % 2 === 0
      ? ownerOrder[slot]
      : ownerOrder[ownerOrder.length - 1 - slot];
    if (!owner) continue;

    const ownerState = ownerStates.find(state => state.owner === owner);
    if (ownerState && ownerState.rosterSlotsRemaining > 0) {
      return { owner, cursor: adjustedPickIndex + 1 };
    }
  }
  return undefined;
};

export const topTargetsFor = (liveState: LiveDraftState): LiveDraftTarget[] =>
  (liveState.shortlist.length > 0
    ? liveState.shortlist.map(target => {
      const liveTarget = liveState.availableTargets.find(candidate =>
        candidate.name === target.name
      );
      if (!liveTarget) {
        throw new Error(`Missing shortlist target "${target.name}" from live board.`);
      }
      return liveTarget;
    })
    : liveState.availableTargets).slice(0, 10);
