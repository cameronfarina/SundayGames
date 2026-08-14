import type { BasePrice, PricePoolSummary } from "./contracts.js";
import { emptyPositionAmounts } from "./math.js";

export const summarizePricePool = (
  prices: readonly Pick<BasePrice, "position" | "price">[],
): PricePoolSummary => {
  const counts = emptyPositionAmounts();
  const spend = emptyPositionAmounts();
  for (const price of prices) {
    counts[price.position] += 1;
    spend[price.position] += price.price;
  }
  return {
    counts,
    spend,
    total: Object.values(spend).reduce((total, amount) => total + amount, 0),
  };
};
