import { GenericAuctionMockError } from "./errors.js";
import { openNomination } from "./nomination.js";
import {
  availableNominationPlayersFor,
  nextNominator,
  selectAiNomination,
} from "./nominationSelection.js";
import { rosterCapacityFor } from "./roster.js";
import { progressCurrentNomination } from "./settlement.js";
import type { GenericAuctionMockState } from "./types.js";

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
        nextState.configuration.minimumBidDollars,
      ),
      nextNominatorIndex: nominator.index,
    };
  }

  throw new GenericAuctionMockError(
    "no_eligible_player",
    "Auction mock could not reach another human decision or a completed roster state.",
  );
};
