import type { Player } from "../../types.js";
import { AuctionBid, AuctionOwnerState } from "./auctionContracts.js";
import { contextPenaltyDampingMultiplierFor, positionOverbidDampingMultiplierFor, topEndDampingMultiplierFor } from "./bidDamping.js";
import { buildStyleMultiplierFor, playerTargetMaxBidFor, remainingPlayerTargetBudgetReserveFor, strategyBudgetMaxBidFor } from "./budgetStrategy.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { replacementPatiencePriceThreshold } from "./constants.js";
import { ownerBehaviorFor, ownerDemandMultiplierFor, rosterNeedMultiplierFor } from "./demand.js";
import { bidVarianceMultiplierFor, deterministicTieBreak } from "./deterministic.js";
import { budgetFlushBidFor, budgetFlushCushionedMaxBidFor, budgetPacingMultiplierFor, competitionPressureMultiplierFor, endgamePressureMultiplierFor, roomPressureMultiplierFor } from "./pressure.js";

export const bidForOwner = (
  state: AuctionOwnerState,
  player: Player,
  ownerStates: readonly AuctionOwnerState[],
  remainingPlayers: readonly Player[],
  scarcityMultiplier: number,
  config: AuctionEngineConfig,
  openingBid = 0,
): AuctionBid => {
  const ownerDemandMultiplier = ownerDemandMultiplierFor(state.owner, player.position, config);
  const rosterNeedMultiplier = rosterNeedMultiplierFor(state, player.position, config);
  const ownerBehavior = ownerBehaviorFor(state.owner, config);
  const behaviorScarcityMultiplier = 1 + (scarcityMultiplier - 1) * ownerBehavior.scarcityChase;
  const buildStyleMultiplier = buildStyleMultiplierFor(state, player, ownerBehavior, config);
  const replacementPatienceMultiplier = player.price <= replacementPatiencePriceThreshold
    ? ownerBehavior.replacementPatience
    : 1;
  const endgamePressureMultiplier = endgamePressureMultiplierFor(state, config);
  const roomPressureMultiplier = roomPressureMultiplierFor(state, player, config);
  const competitionPressureMultiplier = competitionPressureMultiplierFor(
    state,
    player,
    ownerStates,
    remainingPlayers,
    config,
  );
  const budgetPacingMultiplier = budgetPacingMultiplierFor(state, player, config);
  const bidVarianceMultiplier = bidVarianceMultiplierFor(state, player, config);
  const rawBidMultiplier =
    ownerDemandMultiplier *
    rosterNeedMultiplier *
    behaviorScarcityMultiplier *
    ownerBehavior.priceAggression *
    buildStyleMultiplier *
    replacementPatienceMultiplier *
    endgamePressureMultiplier *
    roomPressureMultiplier *
    competitionPressureMultiplier *
    budgetPacingMultiplier *
    bidVarianceMultiplier;
  const topEndDampingMultiplier = topEndDampingMultiplierFor(player, rawBidMultiplier, config);
  const topEndAdjustedBidMultiplier = rawBidMultiplier * topEndDampingMultiplier;
  const positionOverbidDampingMultiplier = positionOverbidDampingMultiplierFor(
    player.position,
    topEndAdjustedBidMultiplier,
    config,
  );
  const contextPenaltyDampingMultiplier = contextPenaltyDampingMultiplierFor(
    player,
    topEndAdjustedBidMultiplier * positionOverbidDampingMultiplier,
    config,
  );
  const replacementLevelBidCap = player.price <= config.minimumBid
    ? config.minimumBid
    : Number.POSITIVE_INFINITY;
  const pricedBidAmount = Math.min(
    replacementLevelBidCap,
    Math.max(
      config.minimumBid,
      Math.round(
        player.price *
          topEndAdjustedBidMultiplier *
          positionOverbidDampingMultiplier *
          contextPenaltyDampingMultiplier,
      ),
    ),
  );
  const playerTargetMaxBid = playerTargetMaxBidFor(state, player, config);
  const targetAdjustedBidAmount = playerTargetMaxBid === undefined
    ? pricedBidAmount
    : Math.max(pricedBidAmount, playerTargetMaxBid);
  const budgetFlushBid = budgetFlushBidFor(state, player, remainingPlayers, config);
  const uncappedAmount = Math.max(targetAdjustedBidAmount, openingBid, budgetFlushBid);
  const strategyBudgetMaxBid = strategyBudgetMaxBidFor(state, player, config);
  const remainingPlayerTargetBudgetReserve = remainingPlayerTargetBudgetReserveFor(
    state,
    player,
    remainingPlayers,
    config,
  );
  const budgetFlushMaxBid = budgetFlushCushionedMaxBidFor(state, remainingPlayers, config);
  const maxBid = playerTargetMaxBid === undefined
    ? Math.min(
      state.maxBid,
      budgetFlushMaxBid ?? state.maxBid,
      strategyBudgetMaxBid ?? state.maxBid,
      remainingPlayerTargetBudgetReserve ?? state.maxBid,
    )
    : Math.min(state.maxBid, budgetFlushMaxBid ?? state.maxBid, playerTargetMaxBid);

  return {
    owner: state.owner,
    amount: Math.min(maxBid, uncappedAmount),
    uncappedAmount,
    maxBid,
    ...(strategyBudgetMaxBid === undefined ? {} : { strategyBudgetMaxBid }),
    ...(playerTargetMaxBid === undefined ? {} : { playerTargetMaxBid }),
    marketPrice: player.price,
    ownerDemandMultiplier,
    rosterNeedMultiplier,
    scarcityMultiplier,
    behaviorAggressionMultiplier: ownerBehavior.priceAggression,
    behaviorScarcityMultiplier,
    buildStyleMultiplier,
    replacementPatienceMultiplier,
    endgamePressureMultiplier,
    roomPressureMultiplier,
    competitionPressureMultiplier,
    budgetPacingMultiplier,
    bidVarianceMultiplier,
    topEndDampingMultiplier,
    positionOverbidDampingMultiplier,
    contextPenaltyDampingMultiplier,
    tieBreak: deterministicTieBreak(config.seed, state.owner, player.name),
  };
};
