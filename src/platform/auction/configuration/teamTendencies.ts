import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { assertNonNegativeMap, isNonNegativeFinite } from "./values.js";

export const assertTeamTendencies = (config: GenericAuctionMockConfig): void => {
  for (const team of config.teams) {
    const tendency = team.aiTendency;
    if (tendency?.bidMultiplier !== undefined
      && !isNonNegativeFinite(tendency.bidMultiplier)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI bid multipliers must be non-negative finite numbers.",
      );
    }
    if (tendency?.randomness !== undefined && !isNonNegativeFinite(tendency.randomness)) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "AI randomness must be a non-negative finite number.",
      );
    }
    if (tendency?.positionBidMultipliers !== undefined) {
      assertNonNegativeMap(tendency.positionBidMultipliers, "AI position bid multipliers");
    }
    if (tendency?.nominationPositionWeights !== undefined) {
      assertNonNegativeMap(tendency.nominationPositionWeights, "AI nomination weights");
    }
  }
};
