import { GenericAuctionMockError } from "../errors.js";
import { bidEventFor, withAuctionEvents } from "../events.js";
import { withDecisionSnapshot } from "../history.js";
import { nominationFor } from "../nomination.js";
import { advanceToHumanDecision } from "../progression.js";
import { assertCanAcquire, playerFor, teamFor } from "../roster.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockState,
} from "../types.js";
import { humanNominationFor } from "./preconditions.js";

type BuyCommand = Extract<GenericAuctionMockCommand, { type: "buy" }>;

export const passOnNomination = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => {
  const nomination = humanNominationFor(state);
  const decided = withDecisionSnapshot(state);
  return advanceToHumanDecision({
    ...decided,
    session: {
      ...decided.session,
      currentNomination: {
        ...nomination,
        humanPassed: true,
        humanCanBuy: false,
        humanCanPass: false,
      },
    },
  });
};

export const buyNomination = (
  state: GenericAuctionMockState,
  command: BuyCommand,
): GenericAuctionMockState => {
  const nomination = humanNominationFor(state);
  if (command.price < nomination.nextBid) {
    throw new GenericAuctionMockError(
      "invalid_price",
      `The next bid for ${nomination.playerName} is $${nomination.nextBid}.`,
    );
  }

  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const player = playerFor(state, nomination.playerId);
  assertCanAcquire(state, humanTeam, player, command.price);
  const decided = withDecisionSnapshot(state);
  const withHumanBid = withAuctionEvents(decided, [
    bidEventFor(nomination, humanTeam, command.price),
  ]);
  return advanceToHumanDecision({
    ...withHumanBid,
    session: {
      ...withHumanBid.session,
      currentNomination: nominationFor({
        state: withHumanBid,
        player,
        nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
        highestBidderTeam: humanTeam,
        currentPrice: command.price,
        humanPassed: false,
      }),
    },
  });
};
