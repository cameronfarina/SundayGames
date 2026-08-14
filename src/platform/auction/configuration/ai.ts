import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { isNonNegativeFinite } from "./values.js";

const aiNumericValuesFor = (config: GenericAuctionMockConfig): readonly (number | undefined)[] => [
  config.ai?.defaultBidMultiplier,
  config.ai?.rosterNeedDollars,
  config.ai?.randomness,
];

export const assertAiConfiguration = (
  config: GenericAuctionMockConfig,
  playerIds: readonly string[],
): void => {
  const hasInvalidNumericValue = aiNumericValuesFor(config).some(value => (
    value !== undefined && !isNonNegativeFinite(value)
  ));
  if (hasInvalidNumericValue) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI settings must be non-negative finite numbers.",
    );
  }

  const targetEndingBudget = config.ai?.targetEndingBudgetDollars;
  if (
    targetEndingBudget !== undefined
    && (!Number.isInteger(targetEndingBudget)
      || targetEndingBudget < 0
      || targetEndingBudget >= config.budgetDollars)
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI target ending budget must be a non-negative whole-dollar amount below the auction budget.",
    );
  }

  const exclusions = config.ai?.spendPacingExcludedPlayerIds ?? [];
  const hasInvalidExclusion = new Set(exclusions).size !== exclusions.length
    || exclusions.some(playerId => !playerIds.includes(playerId));
  if (hasInvalidExclusion) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI spend-pacing exclusions must reference unique players in the auction catalog.",
    );
  }
};
