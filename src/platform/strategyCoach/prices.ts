import type {
  StrategyCoachPlayerCatalogEntry,
  StrategyCoachPriceSource,
} from "./contracts.js";
import type { PricePreference, PriceValue } from "./internalTypes.js";

const draftPriceFields: readonly Exclude<StrategyCoachPriceSource, "prompt">[] = [
  "price",
  "expectedPrice",
  "marketPrice",
  "recommendedMaxBid",
  "maxBid",
  "fallbackPrice",
];

const targetPriceFields: readonly Exclude<StrategyCoachPriceSource, "prompt">[] = [
  "recommendedMaxBid",
  "maxBid",
  "price",
  "expectedPrice",
  "marketPrice",
  "fallbackPrice",
];

export const priceValueFor = (
  entry: StrategyCoachPlayerCatalogEntry,
  preference: PricePreference,
): PriceValue | undefined => {
  const fields = preference === "draft" ? draftPriceFields : targetPriceFields;

  for (const field of fields) {
    const value = entry[field];
    if (value !== undefined && Number.isFinite(value) && value >= 0) {
      return { value, source: field };
    }
  }

  return undefined;
};
