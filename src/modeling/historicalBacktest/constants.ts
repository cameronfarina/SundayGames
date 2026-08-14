import type { Position } from "../../../config/league.js";
import type { HistoricalPriceTier } from "./contracts.js";

interface Thresholds {
  warn: number;
  fail: number;
}

export const priceTiers: readonly HistoricalPriceTier[] = [
  { key: "elite", label: "$60+", minPrice: 60 },
  { key: "strong", label: "$40-$59", minPrice: 40, maxPrice: 59 },
  { key: "starter", label: "$20-$39", minPrice: 20, maxPrice: 39 },
  { key: "depth", label: "$2-$19", minPrice: 2, maxPrice: 19 },
  { key: "dollar", label: "$1", minPrice: 1, maxPrice: 1 },
];

export const highPriceThresholds: readonly number[] = [70, 75, 80];

export const priceTierCountThresholds: Record<HistoricalPriceTier["key"], Thresholds> = {
  elite: { warn: 4, fail: 8 },
  strong: { warn: 5, fail: 10 },
  starter: { warn: 8, fail: 16 },
  depth: { warn: 20, fail: 40 },
  dollar: { warn: 8, fail: 14 },
};

export const positionSpendThresholds: Record<Position, Thresholds> = {
  QB: { warn: 30, fail: 60 },
  RB: { warn: 100, fail: 220 },
  WR: { warn: 100, fail: 220 },
  TE: { warn: 35, fail: 80 },
  K: { warn: 20, fail: 45 },
  DST: { warn: 20, fail: 45 },
};

export const positionCountThresholds: Record<Position, Thresholds> = {
  QB: { warn: 3, fail: 6 },
  RB: { warn: 8, fail: 16 },
  WR: { warn: 8, fail: 16 },
  TE: { warn: 4, fail: 8 },
  K: { warn: 3, fail: 6 },
  DST: { warn: 3, fail: 6 },
};
