import type { Position } from "../../../../config/league.js";
import { threeRbPathRules } from "../../draftPlan.js";
import type {
  LiveDraftOwnerState,
  LiveDraftPathBandStatus,
  LiveDraftPathPriceBand,
  LiveDraftRosterPlayer,
} from "../contracts.js";
import { allPositions } from "../constants.js";
import { ownerPositionSpend } from "../strategyValuation.js";

export const priceBandText = ({
  minimumPrice,
  maximumPrice,
}: Pick<LiveDraftPathPriceBand, "minimumPrice" | "maximumPrice">): string =>
  `$${minimumPrice}-$${maximumPrice}`;

const filledPlayersFor = (
  owner: LiveDraftOwnerState,
  position: Position,
): LiveDraftRosterPlayer[] => owner.roster
  .filter(player => player.position === position)
  .sort((left, right) =>
    right.price - left.price
    || right.expectedPrice - left.expectedPrice
    || left.name.localeCompare(right.name));

const pathBandStatusFor = (
  filledPlayer: LiveDraftRosterPlayer | undefined,
  index: number,
  watchOwner: LiveDraftOwnerState,
  position: Position,
): LiveDraftPathBandStatus => {
  if (filledPlayer) return "filled";
  if (index === watchOwner.positionCounts[position]) return "next";
  return "open";
};

const budgetAdjustedMaximum = (
  band: Pick<LiveDraftPathPriceBand, "position" | "minimumPrice" | "maximumPrice">,
  index: number,
  watchOwner: LiveDraftOwnerState,
  filledPlayer: LiveDraftRosterPlayer | undefined,
): number => {
  if (band.position !== "RB" || filledPlayer) return band.maximumPrice;
  const remainingCoreSlots = Math.max(0, threeRbPathRules.rbCoreBudget.targetCount - index - 1);
  return Math.min(
    band.maximumPrice,
    Math.max(
      band.minimumPrice,
      threeRbPathRules.rbCoreBudget.hardBudget
      - ownerPositionSpend(watchOwner, band.position)
      - remainingCoreSlots * threeRbPathRules.rbCoreBudget.minimumFutureCorePrice,
    ),
  );
};

export const maxPriceBandsForThreeRb = (
  watchOwner: LiveDraftOwnerState,
): LiveDraftPathPriceBand[] => {
  const seenByPosition = new Map<Position, number>();
  const filledByPosition = new Map<Position, LiveDraftRosterPlayer[]>(
    allPositions.map(position => [position, filledPlayersFor(watchOwner, position)]),
  );
  return threeRbPathRules.priceBands.map(band => {
    const index = seenByPosition.get(band.position) ?? 0;
    seenByPosition.set(band.position, index + 1);
    const filledPlayer = filledByPosition.get(band.position)?.[index];
    return {
      slot: band.slot,
      position: band.position,
      minimumPrice: band.minimumPrice,
      maximumPrice: budgetAdjustedMaximum(band, index, watchOwner, filledPlayer),
      status: pathBandStatusFor(filledPlayer, index, watchOwner, band.position),
      note: band.note,
      ...(filledPlayer ? { filledBy: filledPlayer.name } : {}),
    };
  });
};
