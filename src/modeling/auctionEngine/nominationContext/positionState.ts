import type { Owner, Position } from "../../../../config/league.js";
import type { AuctionEngineConfig, PositionAmounts } from "../configContracts.js";
import type { PositionBooleans } from "../nominationTypes.js";

export const emptyPositionBooleans = (): PositionBooleans => ({
  QB: false,
  RB: false,
  WR: false,
  TE: false,
  K: false,
  DST: false,
});

export const directShortageAfterPickFor = (
  candidateOwner: Owner,
  position: Position,
  ownerCounts: ReadonlyMap<Owner, PositionAmounts>,
  config: AuctionEngineConfig,
): number => {
  const positionMinimum = config.starterMinimums[position];
  if (positionMinimum <= 0) return 0;

  return [...ownerCounts.entries()].reduce((shortage, [owner, counts]) => {
    const positionCount = counts[position] + (owner === candidateOwner ? 1 : 0);
    return shortage + Math.max(0, positionMinimum - positionCount);
  }, 0);
};
