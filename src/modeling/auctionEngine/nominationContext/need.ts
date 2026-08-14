import type { Owner, Position } from "../../../../config/league.js";
import type { AuctionEngineConfig, PositionAmounts } from "../configContracts.js";
import { isFlexEligible, isPremiumPosition, rosterMaximumFor } from "../coreMath.js";
import { flexEligibleCount, minimumFlexEligibleCount } from "../rosterRules.js";

export const nominationNeedScoreForCounts = (
  owner: Owner,
  counts: PositionAmounts,
  position: Position,
  config: AuctionEngineConfig,
): number => {
  if (counts[position] >= rosterMaximumFor(owner, position, config)) return 0;

  if (counts[position] < config.starterMinimums[position]) return 1;
  if (isFlexEligible(position) && flexEligibleCount(counts) < minimumFlexEligibleCount(config)) {
    return 0.65;
  }
  if (isPremiumPosition(position) && counts[position] === 0) return 0.2;

  return 0;
};
