import type { BasePrice } from "../basePricing.js";
import type { PlayerAuditMockSale } from "./contracts/mockSale.js";
import type { PlayerAuditScenario } from "./contracts/scenario.js";
import type { PlayerPriceWaterfallStep } from "./contracts/waterfall.js";
import { roundToTwo } from "./math.js";
import { waterfallStep } from "./waterfallStep.js";

export const scenarioSteps = (
  basePrice: BasePrice,
  scenario: PlayerAuditScenario,
  mockSale: PlayerAuditMockSale,
): PlayerPriceWaterfallStep[] => {
  if (!scenario.available) {
    return [waterfallStep(
      "keeper-removal",
      "Keeper removal",
      basePrice.price,
      null,
      `Removed from the ${scenario.label} auction pool${scenario.unavailableReason
        ? `: ${scenario.unavailableReason}`
        : "."}`,
    )];
  }

  return [
    waterfallStep(
      "keeper-inflation",
      "Keeper inflation",
      basePrice.price,
      scenario.scenarioPrice,
      `${scenario.label} keeper inflation uses a ${roundToTwo(scenario.scenarioFactor)}x `
        + `${basePrice.position} factor.`,
      scenario.scenarioFactor,
    ),
    waterfallStep(
      "mock-sale-average",
      "Mock sale average",
      scenario.scenarioPrice,
      mockSale.averageSalePrice,
      mockSale.averageSalePrice === null
        ? `Not drafted in ${mockSale.runCount} mock run(s).`
        : `Observed simulation outcome: drafted ${mockSale.draftedCount} time(s) `
          + `across ${mockSale.runCount} mock run(s).`,
    ),
  ];
};
