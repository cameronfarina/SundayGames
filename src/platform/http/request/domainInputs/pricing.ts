import type { PricingSourcePrice } from "../../../pricingSnapshots.js";
import { arrayValue, optionalNumber, stringValue, unknownRecord } from "../values.js";
import { isPosition } from "./positions.js";

export const pricingSourcePricesFrom = (
  value: unknown,
): readonly PricingSourcePrice[] => arrayValue(value).flatMap(candidate => {
  const record = unknownRecord(candidate);
  if (record === null || !isPosition(record.position)) return [];
  return [{
    name: stringValue(record.name),
    normalizedName: stringValue(record.normalizedName),
    position: record.position,
    price: optionalNumber(record.price) ?? Number.NaN,
  }];
});
