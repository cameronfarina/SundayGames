import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { isNonBlank } from "./values.js";

export const assertPositionMaximums = (config: GenericAuctionMockConfig): void => {
  if (Object.keys(config.positionMaximums).length === 0) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "At least one position maximum is required.",
    );
  }

  for (const [position, maximum] of Object.entries(config.positionMaximums)) {
    if (!isNonBlank(position) || !Number.isInteger(maximum) || maximum < 0) {
      throw new GenericAuctionMockError(
        "invalid_config",
        "Position maximums must be non-negative whole numbers keyed by position.",
      );
    }
  }
};

export const assertPositionCoverage = (config: GenericAuctionMockConfig): void => {
  const configuredPositions = new Set(Object.keys(config.positionMaximums));
  const rosterPositions = config.rosterSlots.flatMap(slot => slot.eligiblePositions);
  const hasUnknownRosterPosition = rosterPositions.some(position => (
    !configuredPositions.has(position)
  ));
  const hasUnknownPlayerPosition = config.players.some(player => (
    !configuredPositions.has(player.position)
  ));
  if (hasUnknownRosterPosition || hasUnknownPlayerPosition) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Every roster and player position must have an explicit position maximum.",
    );
  }
};
