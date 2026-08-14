import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";

export const assertPlannedAcquisitions = (
  config: GenericAuctionMockConfig,
  playerIds: readonly string[],
): void => {
  const acquisitions = config.plannedAcquisitions ?? [];
  const plannedPlayerIds = acquisitions.map(acquisition => acquisition.playerId);
  const hasInvalidAcquisition = acquisitions.some(acquisition => (
    acquisition.teamId !== config.humanTeamId
    || !playerIds.includes(acquisition.playerId)
    || !Number.isInteger(acquisition.price)
    || acquisition.price < config.minimumBidDollars
  ));
  if (
    new Set(plannedPlayerIds).size !== plannedPlayerIds.length
    || hasInvalidAcquisition
  ) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Planned acquisitions require unique catalog players, the human team, and valid prices.",
    );
  }
};
