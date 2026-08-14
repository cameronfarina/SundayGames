import type { KeeperDeclaration } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import {
  applyKeeperScenarioToPrices,
  buildKeeperScenarios,
  type KeeperScenario,
  type KeeperScenarioKey,
  type ScenarioAdjustedPrice,
} from "../keeperInflation.js";
import type { ScenarioResources } from "./contracts.js";

export const requiredScenario = (
  scenarios: readonly KeeperScenario[],
  key: KeeperScenarioKey,
): KeeperScenario => {
  const scenario = scenarios.find(candidate => candidate.key === key);
  if (scenario === undefined) throw new Error(`Unknown keeper scenario "${key}".`);
  return scenario;
};

const priceMapFor = (
  prices: readonly BasePrice[],
  keepers: readonly KeeperDeclaration[],
  scenario: KeeperScenario,
): ReadonlyMap<string, ScenarioAdjustedPrice> => new Map(
  applyKeeperScenarioToPrices(prices, scenario, keepers).availablePrices
    .map(price => [price.normalizedName, price]),
);

const reasonMapFor = (
  scenario: KeeperScenario,
  keepers: readonly KeeperDeclaration[],
): ReadonlyMap<string, string> => new Map(
  keepers
    .filter(keeper => scenario.includedKeeperStatuses.some(
      status => status === keeper.status,
    ))
    .map(keeper => [
      normalizePlayerName(keeper.player),
      `${keeper.owner} ${keeper.status} keeper at $${keeper.newCost}`,
    ]),
);

export const buildScenarioResources = (
  prices: readonly BasePrice[],
  keepers: readonly KeeperDeclaration[],
): ScenarioResources => {
  const scenarios = buildKeeperScenarios(keepers);
  const confirmedOnly = requiredScenario(scenarios, "confirmedOnly");
  const expected = requiredScenario(scenarios, "expected");
  const highRetention = requiredScenario(scenarios, "highRetention");

  return {
    scenarioPriceMaps: {
      confirmedOnly: priceMapFor(prices, keepers, confirmedOnly),
      expected: priceMapFor(prices, keepers, expected),
      highRetention: priceMapFor(prices, keepers, highRetention),
    },
    keeperReasonMaps: {
      confirmedOnly: reasonMapFor(confirmedOnly, keepers),
      expected: reasonMapFor(expected, keepers),
      highRetention: reasonMapFor(highRetention, keepers),
    },
  };
};
