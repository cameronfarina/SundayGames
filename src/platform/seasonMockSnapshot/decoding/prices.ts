import { malformedSnapshot } from "../errors.js";
import {
  finiteNumber,
  nonEmptyString,
  plainRecord,
} from "./primitives.js";

export const expectedPricesValue = (
  value: unknown,
): Readonly<Record<string, number>> => {
  const record = plainRecord(value);
  return Object.freeze(Object.fromEntries(
    Object.entries(record)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, price]) => {
        const normalizedPrice = finiteNumber(price);
        if (normalizedPrice < 0) return malformedSnapshot();
        return [nonEmptyString(key), normalizedPrice];
      }),
  ));
};
