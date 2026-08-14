import type {
  PlayerPriceSnapshotRow,
  PricingSnapshot,
  PricingStrategyOverlay,
} from "./contracts.js";

const deltaFor = (
  deltas: Readonly<Record<string, number>> | undefined,
  row: PlayerPriceSnapshotRow,
): number => deltas?.[row.playerKey] ?? deltas?.[row.normalizedName] ?? 0;

export const applyStrategyOverlay = (
  snapshot: PricingSnapshot,
  overlay: PricingStrategyOverlay,
): PricingSnapshot => ({
  ...snapshot,
  strategyOverlayId: overlay.strategyId,
  rows: snapshot.rows.map(row => ({
    ...row,
    personalValue: row.personalValue + deltaFor(overlay.personalValueDeltas, row),
    recommendedMaxBid: row.recommendedMaxBid
      + deltaFor(overlay.recommendedMaxBidDeltas, row),
    strategyOverlayId: overlay.strategyId,
  })),
});
