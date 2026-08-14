import type { KeeperDeclaration } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import type {
  KeeperScenario,
  ScenarioAdjustedPrice,
} from "../keeperInflation.js";
import type { PlayerAuditScenario } from "./contracts/scenario.js";

export const scenarioPriceFor = (
  adjustedPrices: readonly ScenarioAdjustedPrice[],
  basePrice: BasePrice,
): ScenarioAdjustedPrice | undefined =>
  adjustedPrices.find(price => price.normalizedName === basePrice.normalizedName);

export const keeperReasonFor = (
  unavailableKeepers: readonly KeeperDeclaration[],
  basePrice: BasePrice,
): string | undefined => {
  const keeper = unavailableKeepers.find(candidate =>
    normalizePlayerName(candidate.player) === basePrice.normalizedName,
  );
  if (!keeper) return undefined;

  return `${keeper.owner} ${keeper.status} keeper at $${keeper.newCost}`;
};

export const buildAuditScenario = (
  scenario: KeeperScenario,
  basePrice: BasePrice,
  adjustedPrice: ScenarioAdjustedPrice | undefined,
  unavailableReason: string | undefined,
): PlayerAuditScenario => {
  const positionFactor = scenario.positionFactors[basePrice.position];

  return {
    key: scenario.key,
    label: scenario.label,
    available: Boolean(adjustedPrice),
    totalKeeperCost: scenario.totalKeeperCost,
    openAuctionDollars: scenario.openAuctionDollars,
    globalFactor: scenario.globalFactor,
    positionFactor,
    scenarioFactor: adjustedPrice?.scenarioFactor ?? positionFactor,
    scenarioPrice: adjustedPrice?.scenarioPrice ?? 0,
    ...(adjustedPrice || !unavailableReason ? {} : { unavailableReason }),
  };
};
