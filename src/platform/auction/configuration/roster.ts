import type { GenericAuctionMockConfig } from "../types.js";
import { GenericAuctionMockError } from "../errors.js";
import { expandedRosterSlotName, rosterCapacityFor } from "../roster.js";
import { isNonBlank } from "./values.js";

const hasInvalidSlot = (config: GenericAuctionMockConfig): boolean => (
  config.rosterSlots.length === 0
  || config.rosterSlots.some(slot => (
    !isNonBlank(slot.slot)
    || !Number.isInteger(slot.count)
    || slot.count <= 0
    || slot.eligiblePositions.length === 0
    || slot.eligiblePositions.some(position => !isNonBlank(position))
    || new Set(slot.eligiblePositions).size !== slot.eligiblePositions.length
  ))
);

export const assertRosterConfiguration = (config: GenericAuctionMockConfig): void => {
  if (hasInvalidSlot(config)) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slots require a name, positive count, and unique eligible positions.",
    );
  }

  const slotNames = config.rosterSlots.map(slot => slot.slot);
  const expandedSlotNames = config.rosterSlots.flatMap(slot => (
    Array.from({ length: slot.count }, (_, index) => expandedRosterSlotName(slot, index))
  ));
  const hasDuplicateNames = new Set(slotNames).size !== slotNames.length
    || new Set(expandedSlotNames).size !== expandedSlotNames.length;
  if (hasDuplicateNames) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Roster slot names must remain unique after their counts are expanded.",
    );
  }

  const rosterCapacity = rosterCapacityFor(config);
  if (config.budgetDollars < rosterCapacity * config.minimumBidDollars) {
    throw new GenericAuctionMockError(
      "invalid_config",
      "Auction budget must reserve the minimum bid for every roster slot.",
    );
  }
};
