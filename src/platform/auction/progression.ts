import { remainingValuePerSlotFor } from "./auctionAnalysis.js";
import { GenericAuctionMockError } from "./errors.js";
import { openNomination } from "./nomination.js";
import { budgetPressureLiftFor } from "./ownerSurplus.js";
import { aiMaxBidFor } from "./pricing.js";
import {
  availableNominationPlayersFor,
  nextNominator,
  selectAiNomination,
} from "./nominationSelection.js";
import { rosterCapacityFor } from "./roster.js";
import { progressCurrentNomination } from "./settlement.js";
import type { GenericAuctionMockState } from "./types.js";

// A nominator with money the board can no longer absorb opens at their
// pressure level instead of the minimum bid, the way a real owner announces
// "$15 on this guy" late in a draft. With money and board in balance the
// pressure is zero and every nomination still opens at the minimum bid.
const aiOpeningBidFor = (
  state: GenericAuctionMockState,
  team: Parameters<typeof aiMaxBidFor>[1],
  player: Parameters<typeof aiMaxBidFor>[2],
): number => {
  const minimumBid = state.configuration.minimumBidDollars;
  const pressureOpening = minimumBid + budgetPressureLiftFor(
    team,
    minimumBid,
    remainingValuePerSlotFor(state),
    player.expectedPrice,
  );
  const willingness = aiMaxBidFor(state, team, player, state.session.nominationsCompleted + 1);
  return Math.max(minimumBid, Math.min(pressureOpening, willingness));
};

export const advanceToHumanDecision = (state: GenericAuctionMockState): GenericAuctionMockState => {
  let nextState = state;
  const maximumIterations = state.configuration.teams.length * rosterCapacityFor(state.configuration) * 3;

  for (let iteration = 0; iteration <= maximumIterations; iteration += 1) {
    if (nextState.session.currentNomination !== undefined) {
      const progressed = progressCurrentNomination(nextState);
      nextState = progressed.state;
      if (progressed.waitingForHuman) return nextState;
      continue;
    }

    const nominator = nextNominator(nextState);
    if (nominator === undefined) {
      return {
        ...nextState,
        session: {
          ...nextState.session,
          phase: "ready_to_complete",
          nextNominatorTeamId: undefined,
          currentNomination: undefined,
          canComplete: true,
        },
      };
    }

    if (availableNominationPlayersFor(nextState, nominator.team).length === 0) {
      throw new GenericAuctionMockError(
        "no_eligible_player",
        `${nominator.team.name} cannot fill its remaining roster slots from the available player catalog.`,
      );
    }

    if (nominator.team.isHuman) {
      return {
        ...nextState,
        nextNominatorIndex: nominator.index,
        session: {
          ...nextState.session,
          phase: "awaiting_human_nomination",
          nextNominatorTeamId: nominator.team.id,
          currentNomination: undefined,
          canComplete: false,
        },
      };
    }

    const player = selectAiNomination(nextState, nominator.team);
    nextState = {
      ...openNomination(
        nextState,
        nominator.team,
        player,
        aiOpeningBidFor(nextState, nominator.team, player),
      ),
      nextNominatorIndex: nominator.index,
    };
  }

  throw new GenericAuctionMockError(
    "no_eligible_player",
    "Auction mock could not reach another human decision or a completed roster state.",
  );
};
