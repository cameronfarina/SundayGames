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

  const exemptions = config.ai?.bidPressureExemptPlayerIds ?? [];
  const hasInvalidExemption = new Set(exemptions).size !== exemptions.length
    || exemptions.some(playerId => !playerIds.includes(playerId));
  if (hasInvalidExemption) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "AI bid-pressure exemptions must reference unique players in the auction catalog.",
    );
  }
};
