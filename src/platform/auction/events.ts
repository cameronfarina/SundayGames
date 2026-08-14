import type {
  GenericAuctionMockEvent,
  GenericAuctionMockNomination,
  GenericAuctionMockState,
  GenericAuctionMockTeamReadModel,
} from "./types.js";

export interface AuctionBidMaximum {
  team: GenericAuctionMockTeamReadModel;
  maximum: number;
}

export type AuctionEventInput = Omit<GenericAuctionMockEvent, "sequence">;

export const withAuctionEvents = (
  state: GenericAuctionMockState,
  events: readonly AuctionEventInput[],
): GenericAuctionMockState => events.length === 0 ? state : ({
  ...state,
  auctionEvents: [
    ...state.auctionEvents,
    ...events.map((event, index) => ({
      ...event,
      sequence: state.auctionEvents.length + index + 1,
    })),
  ],
});

export const bidEventFor = (
  nomination: GenericAuctionMockNomination,
  team: GenericAuctionMockTeamReadModel,
  price: number,
): AuctionEventInput => ({
  nominationNumber: nomination.number,
  type: "bid",
  playerId: nomination.playerId,
  playerName: nomination.playerName,
  teamId: team.id,
  teamName: team.name,
  price,
  text: `${team.name} bid $${price}`,
});

export const aiBidEventsFor = (
  nomination: GenericAuctionMockNomination,
  nextNomination: GenericAuctionMockNomination,
  maximums: readonly AuctionBidMaximum[],
): readonly AuctionEventInput[] => {
  if (
    nomination.highestBidderTeamId === nextNomination.highestBidderTeamId
    && nomination.currentPrice === nextNomination.currentPrice
  ) return [];

  const winner = maximums.find(entry => entry.team.id === nextNomination.highestBidderTeamId);
  if (winner === undefined) return [];

  const events: AuctionEventInput[] = [];
  const firstReplayPrice = Math.max(
    nomination.currentPrice + 1,
    nextNomination.currentPrice - 7,
  );
  let nextBidderTeamId = winner.team.id;
  for (let price = nextNomination.currentPrice - 1; price >= firstReplayPrice; price -= 1) {
    const bidders = maximums
      .filter(entry => entry.team.id !== nextBidderTeamId && entry.maximum >= price)
      .sort((left, right) => left.maximum - right.maximum || left.team.id.localeCompare(right.team.id));
    if (bidders.length === 0) break;

    const bidder = bidders[(nextNomination.currentPrice - price - 1) % bidders.length];
    if (bidder === undefined) break;
    events.unshift(bidEventFor(nomination, bidder.team, price));
    nextBidderTeamId = bidder.team.id;
  }

  events.push(bidEventFor(nomination, winner.team, nextNomination.currentPrice));
  return events;
};
