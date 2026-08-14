import { competitiveAuctionBidFor } from "../auctionPriceFormation.js";
import { addAcquisition } from "./acquisitions.js";
import { aiMaximumsFor } from "./aiMaximums.js";
import { GenericAuctionMockError } from "./errors.js";
import {
  aiBidEventsFor,
  type AuctionEventInput,
  withAuctionEvents,
} from "./events.js";
import { nominationFor } from "./nomination.js";
import { canAcquire, playerFor, teamFor } from "./roster.js";
import type { GenericAuctionMockState } from "./types.js";

export const settleNomination = (state: GenericAuctionMockState): GenericAuctionMockState => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) {
    throw new GenericAuctionMockError("invalid_decision", "There is no current nomination to sell.");
  }

  const player = playerFor(state, nomination.playerId);
  const winningTeam = teamFor(state, nomination.highestBidderTeamId);
  const nominatingTeam = teamFor(state, nomination.nominatedByTeamId);
  const sold = addAcquisition({
    state,
    player,
    team: winningTeam,
    price: nomination.currentPrice,
    source: winningTeam.isHuman ? "human" : "ai",
    nominatedByTeam: nominatingTeam,
    nominationNumber: nomination.number,
  });
  const nominatorIndex = state.teams.findIndex(team => team.id === nomination.nominatedByTeamId);

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
    ...[5, 4, 3, 2, 1].map((countdown): AuctionEventInput => ({
      nominationNumber: nomination.number,
      type: "countdown",
      playerId: player.id,
      playerName: player.name,
      countdown,
      text: String(countdown),
    })),
    {
      nominationNumber: nomination.number,
      type: "sold",
      playerId: player.id,
      playerName: player.name,
      teamId: winningTeam.id,
      teamName: winningTeam.name,
      price: nomination.currentPrice,
      text: `Sold to ${winningTeam.name} for $${nomination.currentPrice}`,
    },
  ]);
};

export const progressCurrentNomination = (
  state: GenericAuctionMockState,
): { state: GenericAuctionMockState; waitingForHuman: boolean } => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) return { state, waitingForHuman: false };

  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const player = playerFor(state, nomination.playerId);
  const aiMaximums = aiMaximumsFor(state, nomination);
  let activeMaximums = aiMaximums;
  let nextNomination = nomination;

  if (nomination.highestBidderTeamId === humanTeam.id) {
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nomination.currentPrice,
      highestBidderTeamId: nomination.highestBidderTeamId,
      maximums: aiMaximums,
    });
    if (competitiveBid === undefined) {
      return { state: settleNomination(state), waitingForHuman: false };
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nomination.humanPassed,
    });
  } else {
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nomination.currentPrice,
      highestBidderTeamId: nomination.highestBidderTeamId,
      maximums: aiMaximums,
    });
    if (competitiveBid === undefined) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `No AI team can retain the current bid for ${player.name}.`,
      );
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nomination.humanPassed,
    });
  }

  const humanCanBuy = !nextNomination.humanPassed
    && canAcquire(state, humanTeam, player, nextNomination.nextBid);
  if (!humanCanBuy && nextNomination.highestBidderTeamId !== humanTeam.id) {
    const pacedMaximums = aiMaximumsFor(state, nextNomination, true);
    activeMaximums = pacedMaximums;
    const competitiveBid = competitiveAuctionBidFor({
      currentPrice: nextNomination.currentPrice,
      highestBidderTeamId: nextNomination.highestBidderTeamId,
      maximums: pacedMaximums,
    });
    if (competitiveBid === undefined) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `No AI team can retain the current bid for ${player.name}.`,
      );
    }
    nextNomination = nominationFor({
      state,
      player,
      nominatedByTeam: teamFor(state, nextNomination.nominatedByTeamId),
      highestBidderTeam: competitiveBid.team,
      currentPrice: competitiveBid.price,
      humanPassed: nextNomination.humanPassed,
    });
  }
  const stateWithBidEvents = withAuctionEvents(
    state,
    aiBidEventsFor(nomination, nextNomination, activeMaximums),
  );
  const withStandingBid: GenericAuctionMockState = {
    ...stateWithBidEvents,
    session: {
      ...stateWithBidEvents.session,
      currentNomination: {
        ...nextNomination,
        humanCanBuy,
        humanCanPass: humanCanBuy,
      },
    },
  };

  if (humanCanBuy) {
    return {
      state: {
        ...withStandingBid,
        session: {
          ...withStandingBid.session,
          phase: "awaiting_human_bid",
          nextNominatorTeamId: undefined,
        },
      },
      waitingForHuman: true,
    };
  }

  return { state: settleNomination(withStandingBid), waitingForHuman: false };
};
