import type { PlayerOverride } from "../../../config/playerOverrides.js";
import { calculatePlayerContextAdjustment } from "../playerContext.js";
import type { ProjectionRanking } from "../projectionRankings.js";
import type { PriceCandidate, PricingConfig } from "./contracts.js";
import { minimumPriceFor, projectionFloorFor, rankGapAdjustmentFor } from "./floors.js";
import {
  historicalRoomPricePriorFor,
  type HistoricalAuctionRecordsByName,
} from "./historicalPrior.js";

export const candidateForRanking = (
  ranking: ProjectionRanking,
  spendTarget: number,
  overrideByName: ReadonlyMap<string, PlayerOverride>,
  historicalRecordsByName: HistoricalAuctionRecordsByName,
  config: PricingConfig,
): PriceCandidate => {
  const publicAnchorValue = Math.max(1, ranking.espnAuctionValue ?? 0);
  const positionMultiplier = config.positionMarketMultipliers[ranking.position];
  const rankGapAdjustment = rankGapAdjustmentFor(ranking, config);
  const marketPressure = config.marketPressureByPosition[ranking.position];
  const anchoredPrice =
    publicAnchorValue * positionMultiplier * rankGapAdjustment * marketPressure;
  const projectionFloorPrice = projectionFloorFor(ranking, config);
  const override = overrideByName.get(ranking.normalizedName);
  const sustainabilityFactor = override?.sustainabilityFactor ?? 1;
  const context = calculatePlayerContextAdjustment(
    ranking.normalizedName,
    config.playerContext,
  );
  const historical = historicalRoomPricePriorFor(
    ranking,
    historicalRecordsByName,
    context.cappedAdjustment,
    config,
  );
  const preSustainabilityPrice = Math.max(
    anchoredPrice,
    projectionFloorPrice,
    historical.historicalRoomFloor,
  );
  const adjustmentFactor = sustainabilityFactor * context.factor;
  const rawPrice = preSustainabilityPrice * adjustmentFactor;
  return {
    ...ranking,
    publicAnchorValue,
    positionMultiplier,
    rankGapAdjustment,
    marketPressure,
    anchoredPrice,
    projectionFloorPrice,
    preSustainabilityPrice,
    sustainabilityFactor,
    ...(override === undefined ? {} : { sustainabilityNote: override.note }),
    contextAdjustmentFactor: context.factor,
    contextAdjustmentPercent: context.cappedAdjustment,
    contextSignals: context.signals,
    ...(context.notes === undefined ? {} : { contextNotes: context.notes }),
    ...(context.evidence === undefined ? {} : { contextEvidence: context.evidence }),
    rawPrice,
    ...historical,
    allocationWeight: Math.max(0.01, rawPrice),
    minimumPrice: minimumPriceFor(
      ranking,
      anchoredPrice,
      projectionFloorPrice,
      historical.historicalRoomFloor,
      adjustmentFactor,
      config,
    ),
    hardCeiling: config.hardPriceCeilings[ranking.position],
    spendTarget,
  };
};
