import { positions, type Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig, CompleteOwnerAuctionBehavior } from "./configContracts.js";
import { anchorBuildPriceThreshold, depthBuildPriceThreshold, targetAnchorRosterCount } from "./constants.js";
import { clamp } from "./coreMath.js";
import { remainingPlayerTargetsFor } from "./playerTargets.js";
import { configuredPlayerTargetMaxBidFor } from "./rosterRules.js";

export const anchorRosterCount = (roster: readonly Player[]): number =>
  roster.filter(player => player.price >= anchorBuildPriceThreshold).length;

export const positionAnchorRosterCount = (roster: readonly Player[], position: Position): number =>
  roster.filter(player => player.position === position && player.price >= anchorBuildPriceThreshold).length;

export const positionRosterCount = (roster: readonly Player[], position: Position): number =>
  roster.filter(player => player.position === position).length;

export const positionSpend = (roster: readonly Player[], position: Position): number =>
  roster
    .filter(player => player.position === position)
    .reduce((total, player) => total + player.price, 0);

export const unmetPositionAnchorTargets = (
  state: AuctionOwnerState,
  config: AuctionEngineConfig,
): Position[] => {
  const targets = config.ownerPositionAnchorTargets[state.owner] ?? {};

  return positions.filter(position => {
    const target = targets[position];
    return target !== undefined && positionAnchorRosterCount(state.roster, position) < target;
  });
};

export const strategyBudgetMaxBidFor = (
  state: AuctionOwnerState,
  player: Player,
  config: AuctionEngineConfig,
): number | undefined => {
  const positionAnchorCount = positionAnchorRosterCount(state.roster, player.position);
  const positionSlotCount = positionRosterCount(state.roster, player.position);
  const cappedMaxBids: number[] = [];
  const coreBudgetEnvelope = config.ownerPositionCoreBudgetEnvelopes[state.owner]?.[player.position];
  if (coreBudgetEnvelope && positionSlotCount < coreBudgetEnvelope.targetCount) {
    const futureCoreSlots = Math.max(0, coreBudgetEnvelope.targetCount - positionSlotCount - 1);
    const futureCoreReserve = futureCoreSlots * coreBudgetEnvelope.minimumFutureCorePrice;
    cappedMaxBids.push(Math.floor(
      coreBudgetEnvelope.hardBudget -
        positionSpend(state.roster, player.position) -
        futureCoreReserve,
    ));
  }

  const coreTargets = player.price >= anchorBuildPriceThreshold
    ? config.ownerPositionCoreTargets[state.owner]?.[player.position]
    : undefined;
  if (coreTargets && coreTargets.length > 0) {
    const remainingTargets = coreTargets.slice(positionAnchorCount);
    if (remainingTargets.length > 1) {
      const futureCoreReserve = remainingTargets
        .slice(1)
        .reduce((total, targetPrice) => total + targetPrice, 0);
      const futureCoreSlots = remainingTargets.length - 1;
      const rosterSlotsAfterPurchase = Math.max(0, state.rosterSlotsRemaining - 1);
      const nonCoreSlotsAfterPurchase = Math.max(0, rosterSlotsAfterPurchase - futureCoreSlots);
      cappedMaxBids.push(Math.floor(
        state.budgetRemaining -
          futureCoreReserve -
          nonCoreSlotsAfterPurchase * config.minimumBid,
      ));
    }
  }

  const coreSlotMaxBid = player.price >= anchorBuildPriceThreshold
    ? config.ownerPositionCoreMaxBids[state.owner]?.[player.position]?.[positionAnchorCount]
    : undefined;
  if (coreSlotMaxBid !== undefined) cappedMaxBids.push(coreSlotMaxBid);
  const positionSlotMaxBid = config.ownerPositionSlotMaxBids[state.owner]?.[player.position]?.[positionSlotCount];
  if (positionSlotMaxBid !== undefined) cappedMaxBids.push(positionSlotMaxBid);
  if (cappedMaxBids.length === 0) return undefined;

  return clamp(Math.min(...cappedMaxBids), config.minimumBid, state.maxBid);
};

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
  if (configuredPlayerTargetMaxBidFor(state.owner, player.name, config) !== undefined) return undefined;

  const targets = remainingPlayerTargetsFor(state, remainingPlayers, config);
  if (targets.length === 0) return undefined;

  const reservedExtraBudget = targets.reduce(
    (total, target) => total + Math.max(0, target.maxBid - config.minimumBid),
    0,
  );
  return Math.max(0, state.maxBid - reservedExtraBudget);
};

export const buildStyleMultiplierFor = (
  state: AuctionOwnerState,
  player: Player,
  behavior: CompleteOwnerAuctionBehavior,
  config: AuctionEngineConfig,
): number => {
  const positionAnchorCount = positionAnchorRosterCount(state.roster, player.position);
  const positionAnchorTarget = config.ownerPositionAnchorTargets[state.owner]?.[player.position];
  const coreTargets = config.ownerPositionCoreTargets[state.owner]?.[player.position];
  const hasOpenPositionAnchorTarget = positionAnchorTarget !== undefined &&
    positionAnchorCount < positionAnchorTarget;
  const hasOpenCoreTarget = coreTargets !== undefined &&
    positionAnchorCount < coreTargets.length;
  const unmetTargets = unmetPositionAnchorTargets(state, config);
  if (
    player.price >= anchorBuildPriceThreshold &&
    unmetTargets.length > 0 &&
    !unmetTargets.some(position => position === player.position)
  ) {
    return behavior.depthAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    hasOpenPositionAnchorTarget
  ) {
    return behavior.anchorAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    positionAnchorCount > 0 &&
    !hasOpenCoreTarget
  ) {
    return behavior.depthAggression;
  }

  if (
    player.price >= anchorBuildPriceThreshold &&
    anchorRosterCount(state.roster) < targetAnchorRosterCount
  ) {
    return behavior.anchorAggression;
  }

  if (player.price <= depthBuildPriceThreshold) {
    return behavior.depthAggression;
  }

  return 1;
};
