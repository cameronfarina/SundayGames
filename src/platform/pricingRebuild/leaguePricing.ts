import type { PricingSourcePrice } from "../pricingSnapshots.js";
import {
  flatPricedDollars,
  flatPricedPositions,
  historyUnavailableWarning,
  inflationUnavailableWarning,
  manualInflationWarning,
} from "./constants.js";
import type { LeagueInflationResult } from "./contracts.js";
import { clampWholeDollars } from "./helpers.js";

export const leaguePriceFor = (
  baselinePrice: PricingSourcePrice,
  multiplier: number,
  maximumPrice: number,
  floorDollars = 0,
): number => flatPricedPositions.has(baselinePrice.position)
  ? flatPricedDollars
  : Math.max(
    flatPricedDollars,
    clampWholeDollars(floorDollars, maximumPrice),
    clampWholeDollars(baselinePrice.price * multiplier, maximumPrice),
  );

export const inflationWarningsFor = (
  inflation: LeagueInflationResult,
): readonly string[] => {
  if (inflation.source === "unavailable") return [inflationUnavailableWarning];
  const explanation = `this league pays ${inflation.multiplier}x published market prices`;
  if (inflation.source === "manual") {
    return [manualInflationWarning, explanation];
  }
  if (inflation.source === "budget") {
    return [
      historyUnavailableWarning,
      `${explanation}, from $${inflation.leagueDollars} of league money against a $${inflation.publicDollars} published board`,
    ];
  }
  return [
    `${explanation}, from $${inflation.leagueDollars} paid against $${inflation.publicDollars} published across ${inflation.countedSaleCount} past auction sales`,
  ];
};

export const sourcePriceForScenario = (
  sourcePrice: PricingSourcePrice,
  leaguePrice: number,
  sharedWarnings: readonly string[],
): PricingSourcePrice => ({
  name: sourcePrice.name,
  normalizedName: sourcePrice.normalizedName,
  position: sourcePrice.position,
  price: sourcePrice.price,
  scenarioPrice: leaguePrice,
  warnings: [...new Set([...(sourcePrice.warnings ?? []), ...sharedWarnings])],
  ...(sourcePrice.confidence === undefined ? {} : { confidence: sourcePrice.confidence }),
  ...(sourcePrice.tier === undefined ? {} : { tier: sourcePrice.tier }),
});
