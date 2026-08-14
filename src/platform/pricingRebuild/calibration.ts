import type { Position } from "../../../config/league.js";
import type { PricingSourcePrice } from "../pricingSnapshots.js";
import {
  historicalBlendWeight,
  historySaleCurveWarning,
  historyUnavailableWarning,
  materialHistoricalMoveDollars,
} from "./constants.js";
import type { CalibrationResult } from "./contracts.js";
import { average, clampWholeDollars, playerHistoryKey } from "./helpers.js";

export const calibratedMarketPrice = (
  baselinePrice: PricingSourcePrice,
  playerHistory: ReadonlyMap<string, number[]>,
  positionMultipliers: ReadonlyMap<Position, number>,
  positionPublicValueCoverage: ReadonlyMap<Position, number>,
  historicalRankPrice: number | undefined,
  maximumPrice: number,
): CalibrationResult => {
  const baseline = clampWholeDollars(baselinePrice.price, maximumPrice);
  const ratios = playerHistory.get(
    playerHistoryKey(baselinePrice.normalizedName, baselinePrice.position),
  );
  const playerRatio = ratios === undefined ? undefined : average(ratios);
  if (playerRatio !== undefined) {
    const price = clampWholeDollars(
      baseline + (baseline * playerRatio - baseline) * historicalBlendWeight,
      maximumPrice,
    );
    return { price, historicalMove: price - baseline };
  }
  const positionMultiplier = positionMultipliers.get(baselinePrice.position);
  if (positionMultiplier !== undefined && historicalRankPrice !== undefined) {
    const positionPrice = baseline * positionMultiplier;
    const curvePrice = baseline +
      (historicalRankPrice - baseline) * historicalBlendWeight;
    const coverage = positionPublicValueCoverage.get(baselinePrice.position) ?? 0;
    const price = clampWholeDollars(
      curvePrice + (positionPrice - curvePrice) * coverage,
      maximumPrice,
    );
    return { price, historicalMove: price - baseline };
  }
  if (positionMultiplier !== undefined) {
    const price = clampWholeDollars(baseline * positionMultiplier, maximumPrice);
    return { price, historicalMove: price - baseline };
  }
  if (historicalRankPrice !== undefined) {
    const price = clampWholeDollars(
      baseline + (historicalRankPrice - baseline) * historicalBlendWeight,
      maximumPrice,
    );
    return { price, historicalMove: price - baseline };
  }
  return { price: baseline, historicalMove: 0 };
};

const historicalMoveWarning = (move: number): string | undefined =>
  Math.abs(move) >= materialHistoricalMoveDollars
    ? `league history moved price ${move > 0 ? "up" : "down"} by $${Math.abs(move)}`
    : undefined;

export const historyWarningsFor = (
  recentSaleCount: number,
  publicValueSaleCount: number,
): readonly string[] => {
  if (recentSaleCount === 0) return [historyUnavailableWarning];
  if (publicValueSaleCount === 0) return [historySaleCurveWarning];
  if (publicValueSaleCount === recentSaleCount) return [];
  return [
    `${recentSaleCount - publicValueSaleCount} historical sale(s) lacked same-season public dollar values; league sale-price curves were used where public anchors were unavailable`,
  ];
};

export const sourcePriceForScenario = (
  sourcePrice: PricingSourcePrice,
  calibration: CalibrationResult,
  scenarioPrice: number,
  sharedWarnings: readonly string[],
): PricingSourcePrice => {
  const warning = historicalMoveWarning(calibration.historicalMove);
  const warnings = [
    ...(sourcePrice.warnings ?? []),
    ...sharedWarnings,
    ...(warning === undefined ? [] : [warning]),
  ];
  return {
    name: sourcePrice.name,
    normalizedName: sourcePrice.normalizedName,
    position: sourcePrice.position,
    price: calibration.price,
    scenarioPrice,
    warnings: [...new Set(warnings)],
    ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
    ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
  };
};
