import { leagueConfig } from "../../../config/league.js";
import type { LiveDraftOwnerState, LiveDraftPositionContext } from "./contracts.js";
import { skillPositions } from "./constants.js";

const skillStarterSlots =
  leagueConfig.lineup.RB + leagueConfig.lineup.WR + leagueConfig.lineup.TE + leagueConfig.lineup.FLEX;

const ownerNeedsSkillPosition = (
  owner: LiveDraftOwnerState,
  position: LiveDraftPositionContext["position"],
): boolean => {
  if (owner.rosterSlotsRemaining <= 0) return false;
  if (owner.positionCounts[position] >= leagueConfig.rosterMaximums[position]) return false;
  if (owner.positionCounts[position] < leagueConfig.lineup[position]) return true;
  return owner.positionCounts.RB + owner.positionCounts.WR + owner.positionCounts.TE < skillStarterSlots;
};

export const buildPositionContexts = (
  owners: readonly LiveDraftOwnerState[],
  watchOwner: LiveDraftOwnerState,
): LiveDraftPositionContext[] => skillPositions.map(position => {
  const ownersNeeding = owners
    .filter(owner => ownerNeedsSkillPosition(owner, position))
    .map(owner => owner.owner);
  const blockingMaxBidThreshold = Math.min(watchOwner.maxBid, 60);
  const blockers = owners
    .filter(owner => owner.owner !== watchOwner.owner)
    .filter(owner => ownerNeedsSkillPosition(owner, position))
    .filter(owner => owner.maxBid >= blockingMaxBidThreshold)
    .map(owner => owner.owner);
  const strongestBlockerMaxBid = owners
    .filter(owner => blockers.includes(owner.owner))
    .reduce((maxBid, owner) => Math.max(maxBid, owner.maxBid), 0);
  return { position, ownersNeeding, blockers, strongestBlockerMaxBid };
});
