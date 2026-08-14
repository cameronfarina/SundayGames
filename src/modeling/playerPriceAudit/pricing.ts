import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import type { PlayerAuditPricing } from "./contracts/audit.js";
import { roundToTwo } from "./math.js";

export const findBasePrice = (
  prices: readonly BasePrice[],
  playerName: string,
): BasePrice => {
  const normalizedName = normalizePlayerName(playerName);
  const price = prices.find(candidate => candidate.normalizedName === normalizedName);
  if (!price) throw new Error(`Unable to find priced player "${playerName}".`);
  return price;
};

export const auditPricingFor = (basePrice: BasePrice): PlayerAuditPricing => ({
  rawPublicAnchorValue: basePrice.espnAuctionValue ?? null,
  publicAnchorValue: basePrice.publicAnchorValue,
  projectionRank: basePrice.projectionRank,
  espnRank: basePrice.espnRank ?? null,
  rankGap: basePrice.rankGap ?? null,
  rankGapAdjustment: basePrice.rankGapAdjustment,
  positionMultiplier: basePrice.positionMultiplier,
  marketPressure: basePrice.marketPressure,
  anchoredPrice: roundToTwo(basePrice.anchoredPrice),
  projectionFloorPrice: roundToTwo(basePrice.projectionFloorPrice),
  preSustainabilityPrice: roundToTwo(basePrice.preSustainabilityPrice),
  sustainabilityFactor: basePrice.sustainabilityFactor,
  ...(basePrice.sustainabilityNote
    ? { sustainabilityNote: basePrice.sustainabilityNote }
    : {}),
  contextAdjustmentFactor: basePrice.contextAdjustmentFactor,
  contextAdjustmentPercent: basePrice.contextAdjustmentPercent,
  contextSignals: basePrice.contextSignals,
  ...(basePrice.contextNotes ? { contextNotes: basePrice.contextNotes } : {}),
  contextEvidence: basePrice.contextEvidence ?? [],
  rawPrice: roundToTwo(basePrice.rawPrice),
  hardCeiling: basePrice.hardCeiling,
  basePrice: basePrice.price,
});
