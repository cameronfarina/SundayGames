import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp } from "../coreMath.js";
import { remainingPlayerTargetsFor } from "../playerTargets.js";
import { configuredPlayerTargetMaxBidFor } from "../rosterRules.js";

export const playerTargetMaxBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number | undefined => {
  const configuredMaxBid = configuredPlayerTargetMaxBidFor(state.owner, player.name, config);
  if (configuredMaxBid === undefined) return undefined;

  return clamp(Math.floor(configuredMaxBid), config.minimumBid, state.maxBid);
};

export const remainingPlayerTargetBudgetReserveFor = (
  state: AuctionOwnerState,
  player: Player,
  remainingPlayers: readonly Player[],
  config: AuctionEngineConfig,
): number | undefined => {
  if (configuredPlayerTargetMaxBidFor(state.owner, player.name, config) !== undefined) {
    return undefined;
  }

  const targets = remainingPlayerTargetsFor(state, remainingPlayers, config);
  if (targets.length === 0) return undefined;

  const reservedExtraBudget = targets.reduce(
    (total, target) => total + Math.max(0, target.maxBid - config.minimumBid),
    0,
  );
  return Math.max(0, state.maxBid - reservedExtraBudget);
};
