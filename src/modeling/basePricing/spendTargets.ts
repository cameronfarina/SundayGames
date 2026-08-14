import { positions, type Position } from "../../../config/league.js";
import type { HistoricalAuctionRecord } from "../../data/parseHistoricalBoards.js";
import { buildLeagueOpenAuctionSpendTargets } from "../ownerProfiles.js";
import { defaultPricingConfig } from "./config.js";
import type { PositionAmounts, PricingConfig } from "./contracts.js";
import { emptyPositionAmounts, roundedTotal } from "./math.js";

export const roundSpendTargets = (
  spendTargets: PositionAmounts,
  roundingPriority: readonly Position[] = defaultPricingConfig.spendTargetRoundingPriority,
): PositionAmounts => {
  const rounded = emptyPositionAmounts();
  const fractionalParts = new Map<Position, number>();
  let floorTotal = 0;
  for (const position of positions) {
    const floor = Math.floor(spendTargets[position]);
    rounded[position] = floor;
    floorTotal += floor;
    fractionalParts.set(position, spendTargets[position] - floor);
  }
  const priorityIndex = new Map(
    roundingPriority.map((position, index) => [position, index]),
  );
  const sortedPositions = [...positions].sort(
    (left, right) =>
      (fractionalParts.get(right) ?? 0) - (fractionalParts.get(left) ?? 0) ||
      (priorityIndex.get(left) ?? Number.MAX_SAFE_INTEGER) -
        (priorityIndex.get(right) ?? Number.MAX_SAFE_INTEGER),
  );
  let remainingDollars = roundedTotal(spendTargets) - floorTotal;
  for (const position of sortedPositions) {
    if (remainingDollars <= 0) break;
    rounded[position] += 1;
    remainingDollars -= 1;
  }
  return rounded;
};

export const deriveAuditedSpendTargets = (
  historicalRecords: readonly HistoricalAuctionRecord[],
  config: PricingConfig = defaultPricingConfig,
): PositionAmounts => {
  const historicalTargets = buildLeagueOpenAuctionSpendTargets(historicalRecords);
  return roundSpendTargets(
    historicalTargets.byPosition,
    config.spendTargetRoundingPriority,
  );
};
