import type { BasePrice } from "../basePricing.js";
import type { PlayerAuditMockSale } from "./contracts/mockSale.js";
import type { PlayerAuditScenario } from "./contracts/scenario.js";
import type { PlayerPriceWaterfall } from "./contracts/waterfall.js";
import { baseWaterfallSteps } from "./waterfallBaseSteps.js";
import { scenarioSteps } from "./waterfallScenarioSteps.js";

export const buildWaterfall = (
  basePrice: BasePrice,
  scenario: PlayerAuditScenario,
  mockSale: PlayerAuditMockSale,
): PlayerPriceWaterfall => ({
  summary: {
    anchorPrice: basePrice.publicAnchorValue,
    basePrice: basePrice.price,
    scenarioPrice: scenario.scenarioPrice,
    averageMockSalePrice: mockSale.averageSalePrice,
    saleVsScenarioPrice: mockSale.averageSaleVsScenarioPrice,
  },
  steps: [
    ...baseWaterfallSteps(basePrice),
    ...scenarioSteps(basePrice, scenario, mockSale),
  ],
});
