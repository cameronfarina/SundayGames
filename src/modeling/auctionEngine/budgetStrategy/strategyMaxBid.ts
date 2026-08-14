import type { Player } from "../../../types.js";
import type { AuctionOwnerState } from "../auctionContracts.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { anchorBuildPriceThreshold } from "../constants.js";
import { clamp } from "../coreMath.js";
import {
  positionAnchorRosterCount,
  positionRosterCount,
  positionSpend,
} from "./rosterAccounting.js";

const coreEnvelopeMaxBid = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
  positionSlotCount: number,
): number | undefined => {
  const envelope = config.ownerPositionCoreBudgetEnvelopes[state.owner]?.[player.position];
  if (!envelope || positionSlotCount >= envelope.targetCount) return undefined;

  const futureCoreSlots = Math.max(0, envelope.targetCount - positionSlotCount - 1);
  const futureCoreReserve = futureCoreSlots * envelope.minimumFutureCorePrice;
  return Math.floor(
    envelope.hardBudget - positionSpend(state.roster, player.position) - futureCoreReserve,
  );
};

const coreTargetReserveMaxBid = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
  positionAnchorCount: number,
): number | undefined => {
  if (player.price < anchorBuildPriceThreshold) return undefined;
  const coreTargets = config.ownerPositionCoreTargets[state.owner]?.[player.position];
  if (!coreTargets || coreTargets.length === 0) return undefined;

  const remainingTargets = coreTargets.slice(positionAnchorCount);
  if (remainingTargets.length <= 1) return undefined;

  const futureCoreReserve = remainingTargets
    .slice(1)
    .reduce((total, targetPrice) => total + targetPrice, 0);
  const futureCoreSlots = remainingTargets.length - 1;
  const rosterSlotsAfterPurchase = Math.max(0, state.rosterSlotsRemaining - 1);
  const nonCoreSlotsAfterPurchase = Math.max(0, rosterSlotsAfterPurchase - futureCoreSlots);
  return Math.floor(
    state.budgetRemaining - futureCoreReserve - nonCoreSlotsAfterPurchase * config.minimumBid,
  );
};

export const strategyBudgetMaxBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number | undefined => {
  const anchorCount = positionAnchorRosterCount(state.roster, player.position);
  const slotCount = positionRosterCount(state.roster, player.position);
  const caps: (number | undefined)[] = [
    coreEnvelopeMaxBid(state, player, config, slotCount),
    coreTargetReserveMaxBid(state, player, config, anchorCount),
    player.price >= anchorBuildPriceThreshold
      ? config.ownerPositionCoreMaxBids[state.owner]?.[player.position]?.[anchorCount]
      : undefined,
    config.ownerPositionSlotMaxBids[state.owner]?.[player.position]?.[slotCount],
  ];
  const definedCaps = caps.filter(cap => cap !== undefined);
  if (definedCaps.length === 0) return undefined;

  return clamp(Math.min(...definedCaps), config.minimumBid, state.maxBid);
};
