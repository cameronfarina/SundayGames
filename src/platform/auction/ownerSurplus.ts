import { premiumValueThresholdDollars } from "./pricingConstants.js";
import type { GenericAuctionMockTeamReadModel } from "./types.js";

// The edge surplus buys on any single player: enough to beat a rival at
// market value, never enough to re-inflate the whole board.
const surplusBidLiftShare = 0.1;

// Bench slots take every position; a starter slot is any narrower slot.
const benchSlotNamePrefix = "BENCH";

// Keeper savings chase starters, not bench depth. Surplus only lifts bids on
// a player who can still fill one of this team's open starter slots.
export const fillsOpenStarterSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
): boolean => team.slots.some(slot =>
  slot.playerId === undefined
  && !slot.slot.startsWith(benchSlotNamePrefix)
  && slot.eligiblePositions.includes(position)
);

// A keeper bargain raises the bidding power of the owner who earned it, and
// only that owner. The surplus shrinks as the owner pays above market value.
export const remainingKeeperSurplusFor = (
  team: GenericAuctionMockTeamReadModel,
): number => {
  const keeperSurplus = team.roster.reduce(
    (total, player) => total + (player.source === "keeper"
      ? Math.max(0, player.expectedPrice - player.price)
      : 0),
    0,
  );
  const spentAboveValue = team.roster.reduce(
    (total, player) => total + (player.source === "keeper"
      ? 0
      : Math.max(0, player.price - player.expectedPrice)),
    0,
  );
  return Math.max(0, keeperSurplus - spentAboveValue);
};

const surplusBidLiftFor = (
  team: GenericAuctionMockTeamReadModel,
  position: string,
  expectedPrice: number,
): number => fillsOpenStarterSlotFor(team, position)
  ? Math.min(
    remainingKeeperSurplusFor(team),
    Math.ceil(expectedPrice * surplusBidLiftShare),
  )
  : 0;

const sparePerOpenSlotFor = (
  team: GenericAuctionMockTeamReadModel,
  minimumBid: number,
): number => team.rosterSlotsRemaining <= 0
  ? 0
  : Math.max(0, team.budgetRemaining - team.rosterSlotsRemaining * minimumBid)
    / team.rosterSlotsRemaining;

// History says every owner spends the full budget, and the money lands on
// talent, not on fliers: an owner who missed the studs loads up on the
// $20-39 tier while $1 players stay $1. So each owner prices the remaining
// board by the ratio of their spare cash to what their share of the board
// costs at value, and the lift scales with the player's value. On a final
// slot the ratio takes over and the remaining cash lands there.
export const budgetPressureLiftFor = (
  team: GenericAuctionMockTeamReadModel,
  minimumBid: number,
  remainingValuePerSlot: number,
  expectedPrice: number,
): number => {
  if (expectedPrice >= premiumValueThresholdDollars) return 0;
  const spare = Math.max(
    0,
    team.budgetRemaining - team.rosterSlotsRemaining * minimumBid,
  );
  const fairShareCost = team.rosterSlotsRemaining * remainingValuePerSlot;
  if (fairShareCost <= 0) return 0;
  // A flush owner overpays for talent, but paying stud money for a
  // non-stud is where real owners stop: no-stud teams top out at $31-39.
  return Math.min(
    Math.round(expectedPrice * Math.max(0, spare / fairShareCost - 1)),
    Math.max(0, premiumValueThresholdDollars - 1 - expectedPrice),
  );
};

// Surplus stays a fraction of the player's value so keeper bargains never
// re-inflate the board; spend-down pressure carries no such cap, because
// late-draft players must be able to absorb the room's remaining cash.
export const ownerBidLiftFor = (input: {
  team: GenericAuctionMockTeamReadModel;
  position: string;
  expectedPrice: number;
  minimumBid: number;
  remainingValuePerSlot: number;
  pressureExempt: boolean;
}): number => surplusBidLiftFor(input.team, input.position, input.expectedPrice)
  + (input.pressureExempt
    ? 0
    : budgetPressureLiftFor(
      input.team,
      input.minimumBid,
      input.remainingValuePerSlot,
      input.expectedPrice,
    ));
