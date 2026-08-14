import type { Position } from "../../../config/league.js";
import type { HistoricalSaleRecord } from "../historicalImports.js";
import type { PricingSourcePrice } from "../pricingSnapshots.js";
import {
  historicalBlendWeight,
  maximumHistoricalRatio,
  minimumHistoricalRatio,
} from "./constants.js";
import type {
  PositionInflationResult,
  PositionSaleCurveResult,
} from "./contracts.js";
import { addMapValue, average } from "./helpers.js";

export const createPositionInflationMultipliers = (
  sales: readonly HistoricalSaleRecord[],
): PositionInflationResult => {
  const ratiosByPosition = new Map<Position, number[]>();
  const saleCountByPosition = new Map<Position, number>();
  const multipliers = new Map<Position, number>();
  const publicValueCoverage = new Map<Position, number>();
  let matchedSaleCount = 0;
  for (const sale of sales) {
    saleCountByPosition.set(
      sale.position,
      (saleCountByPosition.get(sale.position) ?? 0) + 1,
    );
    if (sale.publicPriceDollars === undefined || sale.publicPriceDollars <= 0) continue;
    const ratio = Math.min(
      maximumHistoricalRatio,
      Math.max(minimumHistoricalRatio, sale.priceDollars / sale.publicPriceDollars),
    );
    addMapValue(ratiosByPosition, sale.position, ratio);
    matchedSaleCount += 1;
  }
  for (const [position, ratios] of ratiosByPosition) {
    const historicalRatio = average(ratios);
    if (historicalRatio === undefined) continue;
    multipliers.set(
      position,
      1 + (historicalRatio - 1) * historicalBlendWeight,
    );
    publicValueCoverage.set(
      position,
      ratios.length / (saleCountByPosition.get(position) ?? ratios.length),
    );
  }
  return { multipliers, publicValueCoverage, matchedSaleCount };
};

export const createPositionSaleCurves = (
  sales: readonly HistoricalSaleRecord[],
): PositionSaleCurveResult => {
  const seasonPricesByPosition = new Map<Position, Map<number, number[]>>();
  const pricesByPosition = new Map<Position, readonly number[]>();
  for (const sale of sales) {
    const seasonPrices = seasonPricesByPosition.get(sale.position) ?? new Map();
    addMapValue(seasonPrices, sale.seasonYear, sale.priceDollars);
    seasonPricesByPosition.set(sale.position, seasonPrices);
  }
  for (const [position, seasonPrices] of seasonPricesByPosition) {
    const seasonCurves = [...seasonPrices.values()]
      .map(prices => prices.sort((left, right) => right - left));
    const maximumRankCount = Math.max(0, ...seasonCurves.map(prices => prices.length));
    pricesByPosition.set(position, Array.from({ length: maximumRankCount }, (_, rank) =>
      average(seasonCurves.flatMap(prices => {
        const price = prices[rank];
        return price === undefined ? [] : [price];
      })) ?? 0));
  }
  return { pricesByPosition };
};

export const historicalRankPricesForBaselines = (
  baselinePrices: readonly PricingSourcePrice[],
  saleCurves: PositionSaleCurveResult,
): ReadonlyMap<number, number> => {
  const historicalPriceByIndex = new Map<number, number>();
  for (const position of new Set(baselinePrices.map(price => price.position))) {
    const historicalPrices = saleCurves.pricesByPosition.get(position) ?? [];
    baselinePrices.map((price, index) => ({ price, index }))
      .filter(candidate => candidate.price.position === position)
      .sort((left, right) =>
        right.price.price - left.price.price ||
        left.price.normalizedName.localeCompare(right.price.normalizedName))
      .forEach(({ index }, rank) => {
        const historicalPrice = historicalPrices[rank];
        if (historicalPrice !== undefined) historicalPriceByIndex.set(index, historicalPrice);
      });
  }
  return historicalPriceByIndex;
};
