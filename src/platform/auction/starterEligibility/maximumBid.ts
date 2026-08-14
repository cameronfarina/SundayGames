import { auctionClearingPriceCushionDollars } from "../pricingConstants.js";
import { assignableSlotFor } from "../roster.js";
import type {
  GenericAuctionMockPlayer,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "../types.js";
import { projectedWeeklyProductionFor } from "./playerProduction.js";
import { remainingStarterEligiblePlayersFor } from "./starterPool.js";

export const maximumAutomatedAuctionBidFor = (
  state: GenericAuctionMockState,
  team: GenericAuctionMockTeamReadModel,
  player: GenericAuctionMockPlayer,
): number => {
  const assignedSlot = assignableSlotFor(team, player);
  if (assignedSlot === undefined) return 0;

  const remainingSlots = team.slots.filter(slot =>
    slot.playerId === undefined && slot.slot !== assignedSlot.slot
  );
  let reserve = remainingSlots.length * state.configuration.minimumBidDollars;
  const positionsNeedingStarterEligiblePlayers = new Set(remainingSlots
    .filter(slot => slot.eligiblePositions.length === 1)
    .map(slot => slot.eligiblePositions[0])
    .filter((position): position is string => position !== undefined));

  for (const position of positionsNeedingStarterEligiblePlayers) {
    const needed = remainingSlots.filter(slot =>
      slot.eligiblePositions.length === 1 && slot.eligiblePositions[0] === position
    ).length;
    const affordableStarters = remainingStarterEligiblePlayersFor(state, position)
      .filter(candidate => candidate.id !== player.id)
      .sort((left, right) =>
        left.expectedPrice - right.expectedPrice
        || projectedWeeklyProductionFor(right) - projectedWeeklyProductionFor(left)
        || left.id.localeCompare(right.id)
      )
      .slice(0, needed);
    if (affordableStarters.length < needed) continue;

    reserve += affordableStarters.reduce((total, starter) => total + Math.max(
      0,
      Math.round(starter.expectedPrice)
        + auctionClearingPriceCushionDollars
        - state.configuration.minimumBidDollars,
    ), 0);
  }

  return Math.max(0, team.budgetRemaining - reserve);
};
