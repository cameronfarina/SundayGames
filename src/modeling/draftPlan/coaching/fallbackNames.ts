import type { PlayerBatchSummary } from "../../mockBatch.js";
import type { DraftPlanPriceBand } from "../contracts.js";
import type { CoachSlotDefinition } from "../internalContracts.js";

interface FallbackNamesOptions {
  definition: CoachSlotDefinition;
  marketPlayers: readonly PlayerBatchSummary[];
  window: Pick<DraftPlanPriceBand, "minimumPrice" | "maximumPrice">;
  lockedNames: readonly string[];
  targetNames: readonly string[];
}

export const fallbackNamesForBlueprint = ({
  definition,
  marketPlayers,
  window,
  lockedNames,
  targetNames,
}: FallbackNamesOptions): string[] => {
  const excludedNames = new Set([...lockedNames, ...targetNames]);
  const center = (window.minimumPrice + window.maximumPrice) / 2;
  return marketPlayers
    .filter(player => player.position === definition.position)
    .filter(player => !excludedNames.has(player.name))
    .filter(player => player.draftedRate >= 0.15)
    .filter(player =>
      player.averageSalePrice >= window.minimumPrice &&
      player.averageSalePrice <= window.maximumPrice
    )
    .sort(
      (left, right) =>
        right.averageMarketPrice - left.averageMarketPrice ||
        right.draftedRate - left.draftedRate ||
        Math.abs(left.averageSalePrice - center) -
          Math.abs(right.averageSalePrice - center) ||
        left.name.localeCompare(right.name),
    )
    .slice(0, 5)
    .map(player => player.name);
};
