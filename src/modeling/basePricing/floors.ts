import type { ProjectionRanking } from "../projectionRankings.js";
import type { PricingConfig } from "./contracts.js";
import { clamp } from "./math.js";

export const rankGapAdjustmentFor = (
  ranking: ProjectionRanking,
  config: PricingConfig,
): number => {
  const adjustment = clamp(
    (ranking.rankGap ?? 0) * config.rankGapAdjustmentPerRank,
    -config.rankGapAdjustmentCap,
    config.rankGapAdjustmentCap,
  );
  return 1 - adjustment;
};

export const projectionFloorFor = (
  ranking: ProjectionRanking,
  config: PricingConfig,
): number => {
  const rule = config.projectionFloorRules[ranking.position];
  if (
    rule === undefined ||
    ranking.rankGap === undefined ||
    ranking.rankGap > rule.triggerAtRankGapOrBelow
  ) return 0;
  if (ranking.projectionRank <= rule.referenceRank) {
    const decay = Math.log(rule.topRankPrice / rule.referenceRankPrice) /
      Math.max(1, rule.referenceRank - 1);
    return rule.topRankPrice * Math.exp(-decay * (ranking.projectionRank - 1));
  }
  return rule.referenceRankPrice *
    Math.exp(-rule.tailDecay * (ranking.projectionRank - rule.referenceRank));
};

const projectionRankFloorFor = (
  ranking: ProjectionRanking,
  config: PricingConfig,
): number => config.projectionRankPriceFloors[ranking.position]
  ?.find(rule => ranking.projectionRank <= rule.maxProjectionRank)?.price ?? 0;

export const minimumPriceFor = (
  ranking: ProjectionRanking,
  anchoredPrice: number,
  projectionFloorPrice: number,
  historicalRoomFloor: number,
  adjustmentFactor: number,
  config: PricingConfig,
): number => {
  const topAnchorMinimum =
    (ranking.espnAuctionValue ?? 0) >= config.topAnchorMinimum.espnAuctionValueAtLeast
      ? Math.round(
        anchoredPrice * adjustmentFactor * config.topAnchorMinimum.shareOfAnchoredPrice,
      )
      : 1;
  return Math.min(
    config.hardPriceCeilings[ranking.position],
    Math.max(
      1,
      topAnchorMinimum,
      projectionRankFloorFor(ranking, config),
      Math.round(projectionFloorPrice * adjustmentFactor),
      Math.round(historicalRoomFloor * adjustmentFactor),
    ),
  );
};
