import { buildBasePrices, defaultPricingConfig } from "../basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
} from "../keeperInflation.js";
import { runMockBatch } from "../mockBatch.js";
import type { BuildPlayerPriceAuditOptions } from "./contracts/audit.js";
import type { PlayerPriceAudit } from "./contracts/report.js";
import { explanationFor } from "./explanation.js";
import { mockPicksFor, mockSaleFor } from "./mockSale.js";
import { auditPricingFor, findBasePrice } from "./pricing.js";
import {
  buildAuditScenario,
  keeperReasonFor,
  scenarioPriceFor,
} from "./scenario.js";
import { buildWaterfall } from "./waterfall.js";

export const buildPlayerPriceAudit = ({
  playerName,
  projections,
  historicalRecords,
  keepers,
  scenarioKey = "expected",
  runs = 10,
  seedPrefix = "player-audit",
  pricingConfig = defaultPricingConfig,
}: BuildPlayerPriceAuditOptions): PlayerPriceAudit => {
  const prices = buildBasePrices(projections, historicalRecords, pricingConfig);
  const basePrice = findBasePrice(prices, playerName);
  const scenario = buildKeeperScenarios(keepers).find(candidate =>
    candidate.key === scenarioKey,
  );
  if (!scenario) throw new Error(`Unknown keeper scenario "${scenarioKey}".`);

  const appliedScenario = applyKeeperScenarioToPrices(prices, scenario, keepers);
  const adjustedPrice = scenarioPriceFor(appliedScenario.availablePrices, basePrice);
  const auditScenario = buildAuditScenario(
    scenario,
    basePrice,
    adjustedPrice,
    keeperReasonFor(appliedScenario.unavailableKeepers, basePrice),
  );
  const batch = runMockBatch({
    projections,
    historicalRecords,
    keepers,
    scenarioKeys: [scenarioKey],
    runsPerScenario: runs,
    seedPrefix,
    pricingConfig,
  });
  const mockSale = mockSaleFor(
    batch.runs,
    mockPicksFor(batch, basePrice),
    auditScenario.scenarioPrice,
  );

  return {
    player: {
      name: basePrice.name,
      position: basePrice.position,
      normalizedName: basePrice.normalizedName,
      week1: basePrice.weeks[1] ?? 0,
      weeks1To4: basePrice.weeks1To4,
      seasonProjection: basePrice.seasonProjection ?? null,
      ...(basePrice.projectionCalibration === undefined
        ? {}
        : { projectionCalibration: basePrice.projectionCalibration }),
    },
    pricing: auditPricingFor(basePrice),
    scenario: auditScenario,
    mockSale,
    waterfall: buildWaterfall(basePrice, auditScenario, mockSale),
    explanation: explanationFor(basePrice, auditScenario, mockSale),
  };
};
