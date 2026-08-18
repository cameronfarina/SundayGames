import type { GenericAuctionMockTeamReadModel } from "./types.js";

// The edge surplus buys on any single player: enough to beat a rival at
// market value, never enough to re-inflate the whole board.
const surplusBidLiftShare = 0.1;
const combinedBidLiftShare = 0.25;

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

// An owner holding more spare cash per open slot than the room pays up
// rather than watch good players pass by. The pressure is relative, so an
// evenly-funded room adds nothing to any price.
const budgetPressureLiftFor = (
  teams: readonly GenericAuctionMockTeamReadModel[],
  team: GenericAuctionMockTeamReadModel,
  minimumBid: number,
): number => {
  const openTeams = teams.filter(candidate => candidate.rosterSlotsRemaining > 0);
  if (openTeams.length === 0) return 0;
  const roomAverage = openTeams.reduce(
    (total, candidate) => total + sparePerOpenSlotFor(candidate, minimumBid),
    0,
  ) / openTeams.length;
  return Math.max(0, Math.floor(sparePerOpenSlotFor(team, minimumBid) - roomAverage));
};

// Together the two lifts stay a fraction of the player's value, so an owner
// with money outbids a rival at market value without re-inflating the board.
export const ownerBidLiftFor = (input: {
  teams: readonly GenericAuctionMockTeamReadModel[];
  team: GenericAuctionMockTeamReadModel;
  position: string;
  expectedPrice: number;
  minimumBid: number;
  pressureExempt: boolean;
}): number => Math.min(
  surplusBidLiftFor(input.team, input.position, input.expectedPrice)
    + (input.pressureExempt
      ? 0
      : budgetPressureLiftFor(input.teams, input.team, input.minimumBid)),
  Math.ceil(input.expectedPrice * combinedBidLiftShare),
);
