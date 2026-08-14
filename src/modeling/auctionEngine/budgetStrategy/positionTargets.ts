import { positions, type Position } from "../../../../config/league.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { positionAnchorRosterCount } from "./rosterAccounting.js";

export const unmetPositionAnchorTargets = (
  state: AuctionOwnerState,
  config: AuctionEngineConfig,
): Position[] => {
  const targets = config.ownerPositionAnchorTargets[state.owner] ?? {};

  return positions.filter(position => {
    const target = targets[position];
    return target !== undefined &&
      positionAnchorRosterCount(state.roster, position) < target;
  });
};
