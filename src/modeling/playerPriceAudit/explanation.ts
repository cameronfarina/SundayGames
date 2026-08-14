import type { BasePrice } from "../basePricing.js";
import type { PlayerAuditMockSale } from "./contracts/mockSale.js";
import type { PlayerAuditScenario } from "./contracts/scenario.js";
import { roundToTwo } from "./math.js";

export const explanationFor = (
  basePrice: BasePrice,
  scenario: PlayerAuditScenario,
  mockSale: PlayerAuditMockSale,
): string[] => {
  const rawAnchorValue = basePrice.espnAuctionValue ?? null;
  const anchorDescription = rawAnchorValue !== null
    && rawAnchorValue < basePrice.publicAnchorValue
    ? `Raw ESPN anchor $${rawAnchorValue} is floored to effective anchor $${basePrice.publicAnchorValue}`
    : `ESPN anchor $${basePrice.publicAnchorValue}`;
  const baseExplanation = `${anchorDescription} becomes a $${basePrice.price} base price `
    + "after rank gap, league multipliers, context, and spend reconciliation.";
  const calibration = basePrice.projectionCalibration;
  const projectionExplanation = calibration === undefined
    ? []
    : [
        `${calibration.provider} ${calibration.sourceDescription} converts to `
          + `${calibration.calibratedSeasonProjection} points under league scoring, replacing the `
          + `${roundToTwo(calibration.baselineSeasonProjection)}-point ESPN season projection and scaling `
          + `ESPN weekly estimates by ${roundToTwo(calibration.weeklyScaleFactor)}x.`,
      ];

  if (!scenario.available) {
    const reason = scenario.unavailableReason ? `: ${scenario.unavailableReason}` : ".";
    return [
      ...projectionExplanation,
      baseExplanation,
      `${scenario.label} scenario has this player removed from the auction pool${reason}`,
      `Across ${mockSale.runCount} mock run(s), the player was not available for a mock sale.`,
    ];
  }

  const mockExplanation = mockSale.averageSalePrice === null
    ? `Across ${mockSale.runCount} mock run(s), the player was not drafted.`
    : `Across ${mockSale.runCount} mock run(s), the player was drafted `
      + `${mockSale.draftedCount} time(s) at an average mock sale price of `
      + `$${mockSale.averageSalePrice}.`;

  return [
    ...projectionExplanation,
    baseExplanation,
    `${scenario.label} keeper inflation applies a ${roundToTwo(scenario.scenarioFactor)}x `
      + `${basePrice.position} factor, moving the auction-pool anchor to `
      + `$${scenario.scenarioPrice}.`,
    mockExplanation,
  ];
};
