import type { Owner, Position } from "../../../../config/league.js";
import type { Player } from "../../../types.js";
import type { AuctionEngineConfig } from "../configContracts.js";
import { clamp } from "../coreMath.js";
import type { NominationContext } from "../nominationTypes.js";
import { nominationContextCanBidOnPlayer } from "./eligibility.js";

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
