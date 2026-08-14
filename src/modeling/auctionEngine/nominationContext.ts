import { positions, type Owner, type Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionEngineConfig, PositionAmounts } from "./configContracts.js";
import { emptyPositionAmounts } from "./constants.js";
import { clamp, isFlexEligible, isPremiumPosition, rosterMaximumFor } from "./coreMath.js";
import { positionCapacityFor } from "./demand.js";
import { NominationContext, NominationOwnerContext, PositionBooleans } from "./nominationTypes.js";
import { countPositions } from "./ownerStates.js";
import { canOwnerCompleteRosterAfterAddingPositionSlots, flexEligibleCount, minimumFlexEligibleCount } from "./rosterRules.js";

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

export const emptyPositionBooleans = (): PositionBooleans => ({
  QB: false,
  RB: false,
  WR: false,
  TE: false,
  K: false,
  DST: false,
});

export const directShortageAfterPickFor = (
  candidateOwner: Owner,
  position: Position,
  ownerCounts: ReadonlyMap<Owner, PositionAmounts>,
  config: AuctionEngineConfig,
): number => {
  const positionMinimum = config.starterMinimums[position];
  if (positionMinimum <= 0) return 0;

  return [...ownerCounts.entries()].reduce((shortage, [owner, counts]) => {
    const positionCount = counts[position] + (owner === candidateOwner ? 1 : 0);
    return shortage + Math.max(0, positionMinimum - positionCount);
  }, 0);
};

export const buildNominationContext = (
  availablePlayers: readonly Player[],
  ownerStates: readonly AuctionOwnerState[],
  config: AuctionEngineConfig,
): NominationContext => {
  const availablePositionCounts = countPositions(availablePlayers);
  const ownerCounts = new Map(ownerStates.map(state => [state.owner, countPositions(state.roster)]));
  const ownersNeedingPosition = emptyPositionAmounts();
  const ownerContexts = ownerStates.map(state => {
    const counts = ownerCounts.get(state.owner);
    if (!counts) throw new Error(`Missing nomination counts for ${state.owner}.`);

    const canCompleteAfterAdding = emptyPositionBooleans();
    const directShortageAfterPick = emptyPositionAmounts();
    const needScore = emptyPositionAmounts();
    const capacity = emptyPositionAmounts();

    for (const position of positions) {
      canCompleteAfterAdding[position] = canOwnerCompleteRosterAfterAddingPositionSlots(
        state,
        position,
        1,
        config,
      );
      directShortageAfterPick[position] = directShortageAfterPickFor(
        state.owner,
        position,
        ownerCounts,
        config,
      );
      needScore[position] = nominationNeedScoreForCounts(state.owner, counts, position, config);
      capacity[position] = positionCapacityFor(state, position, config);
      if (needScore[position] > 0) ownersNeedingPosition[position] += 1;
    }

    return {
      state,
      canCompleteAfterAdding,
      directShortageAfterPick,
      needScore,
      capacity,
    };
  });

  return {
    availablePositionCounts,
    ownerContexts,
    ownerContextByOwner: new Map(ownerContexts.map(context => [context.state.owner, context])),
    ownersNeedingPosition,
  };
};

export const nominationContextCanBidOnPlayer = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): boolean =>
  context.state.maxBid >= config.minimumBid &&
  context.canCompleteAfterAdding[player.position] &&
  remainingPlayersAtPlayerPosition >= context.directShortageAfterPick[player.position];

export const nominationAffordabilityScoreFor = (
  context: NominationOwnerContext,
  player: Player,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
): number => {
  if (!nominationContextCanBidOnPlayer(context, player, remainingPlayersAtPlayerPosition, config)) {
    return 0;
  }
  if (player.price <= config.minimumBid) return 1;

  return clamp(context.state.maxBid / player.price, 0, 1);
};

export const nominationScarcityScoreFor = (
  position: Position,
  context: NominationContext,
): number => {
  const playersAtPosition = context.availablePositionCounts[position];
  const ownersNeedingPosition = context.ownersNeedingPosition[position];

  return clamp(ownersNeedingPosition / Math.max(1, playersAtPosition), 0, 1);
};

export const nominationFlushMoneyScoreFor = (
  nominator: Owner,
  player: Player,
  context: NominationContext,
  remainingPlayersAtPlayerPosition: number,
  config: AuctionEngineConfig,
  marketPriceScore: number,
  nominatorInterestScore: number,
): number => {
  const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
  const otherOwnerCount = Math.max(1, context.ownerContexts.length - 1);
  const interestedOtherOwners = context.ownerContexts
    .filter(ownerContext => ownerContext.state.owner !== nominator)
    .filter(ownerContext =>
      nominationContextCanBidOnPlayer(
        ownerContext,
        player,
        remainingPlayersAtPlayerPosition,
        config,
      ))
    .filter(ownerContext => ownerContext.state.maxBid >= reservePrice)
    .length;
  const bidderPressure = interestedOtherOwners / otherOwnerCount;
  const lowPersonalInterest = 1 - clamp(nominatorInterestScore, 0, 1) * 0.5;

  return bidderPressure * marketPriceScore * lowPersonalInterest;
};

export const nominationOpponentNeedScoreFor = (
  nominator: Owner,
  player: Player,
  context: NominationContext,
  config: AuctionEngineConfig,
): number => {
  const otherOwnerContexts = context.ownerContexts.filter(ownerContext => ownerContext.state.owner !== nominator);
  if (otherOwnerContexts.length === 0) return 0;

  const totalNeed = otherOwnerContexts.reduce((total, ownerContext) => {
    const needScore = ownerContext.needScore[player.position];
    if (needScore <= 0) return total;
    if (ownerContext.capacity[player.position] <= 0) return total;

    const reservePrice = Math.max(config.minimumBid, Math.round(player.price * config.reservePriceRatio));
    if (ownerContext.state.maxBid < reservePrice) return total;

    const affordabilityScore = player.price <= config.minimumBid
      ? 1
      : clamp(ownerContext.state.maxBid / player.price, 0, 1);
    return total + needScore * affordabilityScore;
  }, 0);

  return clamp(totalNeed / otherOwnerContexts.length, 0, 1);
};
