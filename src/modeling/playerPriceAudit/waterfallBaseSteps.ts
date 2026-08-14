import type { BasePrice } from "../basePricing.js";
import type { PlayerPriceWaterfallStep } from "./contracts/waterfall.js";
import { waterfallStep } from "./waterfallStep.js";

export const baseWaterfallSteps = (basePrice: BasePrice): PlayerPriceWaterfallStep[] => {
  const afterPositionMultiplier = basePrice.publicAnchorValue * basePrice.positionMultiplier;
  const afterRankGapAdjustment = afterPositionMultiplier * basePrice.rankGapAdjustment;
  const afterMarketPressure = afterRankGapAdjustment * basePrice.marketPressure;
  const afterProjectionFloor = basePrice.preSustainabilityPrice;
  const afterSustainability = afterProjectionFloor * basePrice.sustainabilityFactor;
  const rawAnchorValue = basePrice.espnAuctionValue ?? null;
  const anchorNote = rawAnchorValue !== null && rawAnchorValue < basePrice.publicAnchorValue
    ? `Raw ESPN auction value $${rawAnchorValue} is floored to the model minimum `
      + `anchor of $${basePrice.publicAnchorValue}.`
    : "Public ESPN auction value used as the external starting point.";

  return [
    waterfallStep(
      "espn-anchor",
      "Effective ESPN auction anchor",
      0,
      basePrice.publicAnchorValue,
      anchorNote,
    ),
    waterfallStep(
      "position-multiplier",
      "League positional multiplier",
      basePrice.publicAnchorValue,
      afterPositionMultiplier,
      `${basePrice.position} prices are scaled to this league's historical open-auction market.`,
      basePrice.positionMultiplier,
    ),
    waterfallStep(
      "rank-gap-adjustment",
      "Projection rank gap",
      afterPositionMultiplier,
      afterRankGapAdjustment,
      basePrice.rankGap === undefined
        ? "No ESPN positional rank gap was available, so no rank-gap movement was applied."
        : `Model positional rank is ${basePrice.rankGap} spot(s) away from the ESPN rank.`,
      basePrice.rankGapAdjustment,
    ),
    waterfallStep(
      "market-pressure",
      "League market pressure",
      afterRankGapAdjustment,
      afterMarketPressure,
      "Applies position-level auction pressure before player-specific overrides.",
      basePrice.marketPressure,
    ),
    waterfallStep(
      "projection-floor",
      "Projection floor",
      afterMarketPressure,
      afterProjectionFloor,
      basePrice.projectionFloorPrice > afterMarketPressure
        ? "Projection rank floor lifted the player above the anchored price."
        : "Projection rank floor did not lift this player above the anchored price.",
    ),
    waterfallStep(
      "sustainability",
      "Role sustainability",
      afterProjectionFloor,
      afterSustainability,
      basePrice.sustainabilityNote ?? "No manual role-sustainability override applied.",
      basePrice.sustainabilityFactor,
    ),
    waterfallStep(
      "factual-context",
      "Factual context",
      afterSustainability,
      basePrice.rawPrice,
      `${basePrice.contextEvidence?.length ?? 0} sourced evidence row(s) `
        + "contributed to the context adjustment.",
      basePrice.contextAdjustmentFactor,
    ),
    waterfallStep(
      "spend-reconciliation",
      "Spend reconciliation and ceiling",
      basePrice.rawPrice,
      basePrice.price,
      `Reconciles into historical ${basePrice.position} spend while respecting `
        + "price ceilings and rounding.",
    ),
  ];
};
