import type { KeeperDeclaration } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";
import type {
  KeeperReasonMaps,
  KeeperScenarioPlayerState,
  KeeperScenarioPlayerStates,
  ScenarioPriceMaps,
} from "./contracts.js";
import { outsidePricedPoolReason } from "./constants.js";

const stateForPrice = (
  price: BasePrice,
  availableByName: ScenarioPriceMaps["expected"],
  reasonsByName: KeeperReasonMaps["expected"],
): KeeperScenarioPlayerState => {
  const scenarioPrice = availableByName.get(price.normalizedName);
  if (scenarioPrice !== undefined) {
    return {
      available: true,
      scenarioPrice: scenarioPrice.scenarioPrice,
      scenarioFactor: scenarioPrice.scenarioFactor,
      keeperRemoved: false,
    };
  }
  const unavailableReason = reasonsByName.get(price.normalizedName);
  return {
    available: false,
    scenarioPrice: null,
    scenarioFactor: null,
    keeperRemoved: unavailableReason !== undefined,
    ...(unavailableReason === undefined ? {} : { unavailableReason }),
  };
};

export const statesForPrice = (
  price: BasePrice,
  prices: ScenarioPriceMaps,
  reasons: KeeperReasonMaps,
): KeeperScenarioPlayerStates => ({
  confirmedOnly: stateForPrice(price, prices.confirmedOnly, reasons.confirmedOnly),
  expected: stateForPrice(price, prices.expected, reasons.expected),
  highRetention: stateForPrice(price, prices.highRetention, reasons.highRetention),
});

const stateForUnpricedKeeper = (
  normalizedName: string,
  reasons: ReadonlyMap<string, string>,
): KeeperScenarioPlayerState => {
  const unavailableReason = reasons.get(normalizedName) ?? outsidePricedPoolReason;
  return {
    available: false,
    scenarioPrice: null,
    scenarioFactor: null,
    keeperRemoved: unavailableReason !== outsidePricedPoolReason,
    unavailableReason,
  };
};

export const statesForUnpricedKeeper = (
  keeper: KeeperDeclaration,
  reasons: KeeperReasonMaps,
): KeeperScenarioPlayerStates => {
  const name = normalizePlayerName(keeper.player);
  return {
    confirmedOnly: stateForUnpricedKeeper(name, reasons.confirmedOnly),
    expected: stateForUnpricedKeeper(name, reasons.expected),
    highRetention: stateForUnpricedKeeper(name, reasons.highRetention),
  };
};
