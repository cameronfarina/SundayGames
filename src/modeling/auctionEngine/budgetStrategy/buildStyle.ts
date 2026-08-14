import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type {
  AuctionEngineConfig,
  CompleteOwnerAuctionBehavior,
} from "../configContracts.js";
import {
  anchorBuildPriceThreshold,
  depthBuildPriceThreshold,
  targetAnchorRosterCount,
} from "../constants.js";
import { unmetPositionAnchorTargets } from "./positionTargets.js";
import {
  anchorRosterCount,
  positionAnchorRosterCount,
} from "./rosterAccounting.js";

export const buildStyleMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  behavior: CompleteOwnerAuctionBehavior,
  config: AuctionEngineConfig,
): number => {
  const anchorCount = positionAnchorRosterCount(state.roster, player.position);
  const anchorTarget = config.ownerPositionAnchorTargets[state.owner]?.[player.position];
  const coreTargets = config.ownerPositionCoreTargets[state.owner]?.[player.position];
  const hasOpenAnchorTarget = anchorTarget !== undefined && anchorCount < anchorTarget;
  const hasOpenCoreTarget = coreTargets !== undefined && anchorCount < coreTargets.length;
  const isAnchor = player.price >= anchorBuildPriceThreshold;
  const unmetTargets = unmetPositionAnchorTargets(state, config);

  if (isAnchor && unmetTargets.length > 0 && !unmetTargets.includes(player.position)) {
    return behavior.depthAggression;
  }
  if (isAnchor && hasOpenAnchorTarget) return behavior.anchorAggression;
  if (isAnchor && anchorCount > 0 && !hasOpenCoreTarget) return behavior.depthAggression;
  if (isAnchor && anchorRosterCount(state.roster) < targetAnchorRosterCount) {
    return behavior.anchorAggression;
  }
  if (player.price <= depthBuildPriceThreshold) return behavior.depthAggression;

  return 1;
};
