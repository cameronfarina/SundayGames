import type { KeeperDeclaration } from "../../../config/keepers.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { BasePrice } from "../basePricing.js";

export const unpricedKeepersFor = (
  prices: readonly BasePrice[],
  keepers: readonly KeeperDeclaration[],
): KeeperDeclaration[] => {
  const pricedNames = new Set(prices.map(price => price.normalizedName));
  const unpricedByName = new Map<string, KeeperDeclaration>();
  for (const keeper of keepers) {
    const name = normalizePlayerName(keeper.player);
    if (!pricedNames.has(name) && !unpricedByName.has(name)) {
      unpricedByName.set(name, keeper);
    }
  }
  return [...unpricedByName.values()];
};
