import type { KeeperDeclaration } from "../../../config/keepers.js";
import type { BasePrice } from "../basePricing.js";
import type {
  KeeperReasonMaps,
  ScenarioPriceMaps,
  UnrankedSensitivityRow,
} from "./contracts.js";
import { statesForPrice, statesForUnpricedKeeper } from "./playerStates.js";
import { metricsFor } from "./rowMetrics.js";

export const rowForPrice = (
  price: BasePrice,
  scenarioMaps: ScenarioPriceMaps,
  reasonMaps: KeeperReasonMaps,
): UnrankedSensitivityRow => {
  const scenarios = statesForPrice(price, scenarioMaps, reasonMaps);
  const metrics = metricsFor(scenarios);
  return {
    player: price.name,
    position: price.position,
    pricedPool: true,
    basePrice: price.price,
    publicAnchorValue: price.publicAnchorValue,
    scenarios,
    ...metrics,
    sortScore: metrics.keeperRemovalChanged
      ? 1000 + price.price
      : metrics.keeperRemoved ? 900 + price.price : metrics.largestDelta,
  };
};

export const rowForUnpricedKeeper = (
  keeper: KeeperDeclaration,
  reasonMaps: KeeperReasonMaps,
): UnrankedSensitivityRow => {
  const scenarios = statesForUnpricedKeeper(keeper, reasonMaps);
  const metrics = metricsFor(scenarios);
  return {
    player: keeper.player,
    position: keeper.position,
    pricedPool: false,
    basePrice: null,
    publicAnchorValue: null,
    scenarios,
    ...metrics,
    sortScore: metrics.keeperRemovalChanged ? 1000 : metrics.keeperRemoved ? 900 : 0,
  };
};
