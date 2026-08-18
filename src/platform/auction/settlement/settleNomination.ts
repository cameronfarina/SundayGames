import { addAcquisition } from "../acquisitions.js";
import { automatedClosingPriceFor } from "../closingPrice.js";
import { aiMaxBidFor } from "../pricing.js";
import { GenericAuctionMockError } from "../errors.js";
import { type AuctionEventInput, withAuctionEvents } from "../events.js";
import { playerFor, teamFor } from "../roster.js";
import type { GenericAuctionMockState } from "../types.js";

const countdownEventsFor = (
  nominationNumber: number,
  playerId: string,
  playerName: string,
): readonly AuctionEventInput[] => [5, 4, 3, 2, 1].map(countdown => ({
  nominationNumber,
  type: "countdown",
  playerId,
  playerName,
  countdown,
  text: String(countdown),
}));

export const settleNomination = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) {
    throw new GenericAuctionMockError("invalid_decision", "There is no current nomination to sell.");
  }

  const player = playerFor(state, nomination.playerId);
  const winner = teamFor(state, nomination.highestBidderTeamId);
  const nominator = teamFor(state, nomination.nominatedByTeamId);
  const closingPrice = winner.isHuman
    ? nomination.currentPrice
    : automatedClosingPriceFor(
      state,
      winner,
      player,
      nomination.currentPrice,
      aiMaxBidFor(state, winner, player, nomination.number),
    );
  const sold = addAcquisition({
    state,
    player,
    team: winner,
    price: closingPrice,
    source: winner.isHuman ? "human" : "ai",
    nominatedByTeam: nominator,
    nominationNumber: nomination.number,
  });
  const nominatorIndex = state.teams.findIndex(team => team.id === nominator.id);
  const settled: GenericAuctionMockState = {
    ...sold,
    nextNominatorIndex: (nominatorIndex + 1) % state.teams.length,
    session: {
      ...sold.session,
      currentNomination: undefined,
      nominationsCompleted: state.session.nominationsCompleted + 1,
    },
  };

  return withAuctionEvents(settled, [
    ...countdownEventsFor(nomination.number, player.id, player.name),
    {
      nominationNumber: nomination.number,
      type: "sold",
      playerId: player.id,
      playerName: player.name,
      teamId: winner.id,
      teamName: winner.name,
      price: closingPrice,
      text: `Sold to ${winner.name} for $${closingPrice}`,
    },
  ]);
};
