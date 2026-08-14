import type { Position } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionEngineConfig } from "./configContracts.js";
import { clamp } from "./coreMath.js";

export const topEndDampingMultiplierFor = (
  player: Player,
  rawBidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (rawBidMultiplier <= 1) return 1;

  const { startPrice, fullEffectPrice, maxOverbidDiscount } = config.topEndOverbidDamping;
  if (player.price < startPrice || maxOverbidDiscount <= 0) return 1;

  const priceRange = Math.max(1, fullEffectPrice - startPrice);
  const priceScale = clamp((player.price - startPrice) / priceRange, 0, 1);
  const overbidDiscount = clamp(priceScale * maxOverbidDiscount, 0, maxOverbidDiscount);
  const adjustedBidMultiplier = 1 + (rawBidMultiplier - 1) * (1 - overbidDiscount);

  return adjustedBidMultiplier / rawBidMultiplier;
};

export const positionOverbidDampingMultiplierFor = (
  position: Position,
  bidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (bidMultiplier <= 1) return 1;

  const overbidDiscount = config.positionOverbidDamping[position] ?? 0;
  if (overbidDiscount <= 0) return 1;

  const adjustedBidMultiplier = 1 + (bidMultiplier - 1) * (1 - clamp(overbidDiscount, 0, 1));
  return adjustedBidMultiplier / bidMultiplier;
};

export const contextPenaltyDampingMultiplierFor = (
  player: Player,
  bidMultiplier: number,
  config: AuctionEngineConfig,
): number => {
  if (bidMultiplier <= 1) return 1;
  if (player.price < config.contextPenaltyBidDamping.minimumPlayerPrice) return 1;

  const penalty = -(player.contextAdjustmentPercent ?? 0);
  const { startPenalty, fullEffectPenalty, maxOverbidDiscount } = config.contextPenaltyBidDamping;
  if (penalty < startPenalty || maxOverbidDiscount <= 0) return 1;

  const penaltyRange = Math.max(0.001, fullEffectPenalty - startPenalty);
  const penaltyScale = clamp((penalty - startPenalty) / penaltyRange, 0, 1);
  const overbidDiscount = clamp(penaltyScale * maxOverbidDiscount, 0, maxOverbidDiscount);
  const adjustedBidMultiplier = 1 + (bidMultiplier - 1) * (1 - overbidDiscount);

  return adjustedBidMultiplier / bidMultiplier;
};
