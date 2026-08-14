import { positions } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig, PositionAmounts } from "./configContracts.js";
import { emptyPositionAmounts } from "./constants.js";
import { clamp, rosterMaximumFor } from "./coreMath.js";
import { countPositions } from "./ownerStates.js";
import { configuredPlayerTargetMaxBidFor, playerTargetKey } from "./rosterRules.js";

export interface RemainingPlayerTarget {
  player: Player;
  maxBid: number;
}

export const remainingPlayerTargetsFor = (
  state: AuctionOwnerState,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): RemainingPlayerTarget[] => {
  const targetMaxBids = config.ownerPlayerTargetMaxBids[state.owner];
  if (!targetMaxBids) return [];

  const rosteredTargetKeys = new Set(state.roster.map(player => playerTargetKey(player.name)));
  return Object.entries(targetMaxBids).flatMap(([targetName, configuredMaxBid]) => {
    if (configuredMaxBid === undefined) return [];

    const targetKey = playerTargetKey(targetName);
    if (rosteredTargetKeys.has(targetKey)) return [];

    const targetPlayer = remainingPlayers.find(candidate => playerTargetKey(candidate.name) === targetKey);
    if (!targetPlayer) return [];

    return [{
      player: targetPlayer,
      maxBid: clamp(Math.floor(configuredMaxBid), config.minimumBid, state.maxBid),
    }];
  });
};

export const targetPositionCountsFor = (
  targets: readonly RemainingPlayerTarget[],
): PositionAmounts => {
  const counts = emptyPositionAmounts();
  for (const target of targets) counts[target.player.position] += 1;
  return counts;
};

export const preservesRemainingPlayerTargetsAfterAdding = (
  state: AuctionOwnerState,
  player: Player,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): boolean => {
  if (configuredPlayerTargetMaxBidFor(state.owner, player.name, config) !== undefined) return true;

  const targets = remainingPlayerTargetsFor(state, remainingPlayers, config);
  if (targets.length === 0) return true;
  if (state.rosterSlotsRemaining - 1 < targets.length) return false;

  const countsAfterAdding = countPositions(state.roster);
  countsAfterAdding[player.position] += 1;
  const targetCounts = targetPositionCountsFor(targets);

  return positions.every(position =>
    countsAfterAdding[position] + targetCounts[position] <= rosterMaximumFor(state.owner, position, config)
  );
};
