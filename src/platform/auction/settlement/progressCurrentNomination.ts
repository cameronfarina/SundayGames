import { aiBidEventsFor, withAuctionEvents } from "../events.js";
import { canAcquire, playerFor, teamFor } from "../roster.js";
import type {
  GenericAuctionMockNomination,
  GenericAuctionMockState,
} from "../types.js";
import {
  advanceAiBid,
  requireAdvancedAiBid,
  type AdvancedAiBid,
} from "./advanceAiBid.js";
import { settleNomination } from "./settleNomination.js";

export interface NominationProgress {
  state: GenericAuctionMockState;
  waitingForHuman: boolean;
}

const standingBidState = (
  state: GenericAuctionMockState,
  originalNomination: GenericAuctionMockNomination,
  advanced: AdvancedAiBid,
  humanCanBuy: boolean,
): GenericAuctionMockState => {
  const withEvents = withAuctionEvents(
    state,
    aiBidEventsFor(originalNomination, advanced.nomination, advanced.maximums),
  );
  return {
    ...withEvents,
    session: {
      ...withEvents.session,
      currentNomination: {
        ...advanced.nomination,
        humanCanBuy,
        humanCanPass: humanCanBuy,
      },
    },
  };
};

export const progressCurrentNomination = (
  state: GenericAuctionMockState,
): NominationProgress => {
  const nomination = state.session.currentNomination;
  if (nomination === undefined) return { state, waitingForHuman: false };

  const humanTeam = teamFor(state, state.configuration.humanTeamId);
  const player = playerFor(state, nomination.playerId);
  const initialAdvance = nomination.highestBidderTeamId === humanTeam.id
    ? advanceAiBid(state, nomination)
    : requireAdvancedAiBid(state, nomination);
  if (initialAdvance === undefined) {
    return { state: settleNomination(state), waitingForHuman: false };
  }

  const humanCanBuy = !initialAdvance.nomination.humanPassed
    && canAcquire(state, humanTeam, player, initialAdvance.nomination.nextBid);
  const withStandingBid = standingBidState(
    state,
    nomination,
    initialAdvance,
    humanCanBuy,
  );

  if (!humanCanBuy) {
    return { state: settleNomination(withStandingBid), waitingForHuman: false };
  }

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
};
