import { GenericAuctionMockError } from "../errors.js";
import { restoreLastDecision } from "../history.js";
import { advanceToHumanDecision } from "../progression.js";
import type { GenericAuctionMockState } from "../types.js";

export const startAuction = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => {
  if (state.session.status !== "setup") {
    throw new GenericAuctionMockError("invalid_status", "The auction mock has already started.");
  }

  return advanceToHumanDecision({
    ...state,
    session: {
      ...state.session,
      status: "active",
    },
  });
};

export const undoAuctionDecision = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => restoreLastDecision(state);

export const completeAuction = (
  state: GenericAuctionMockState,
): GenericAuctionMockState => {
  if (!state.session.canComplete || state.teams.some(team => team.rosterSlotsRemaining > 0)) {
    throw new GenericAuctionMockError(
      "draft_incomplete",
      "Every team roster must be full before completing the auction mock.",
    );
  }

  return {
    ...state,
    decisionHistory: [],
    session: {
      ...state.session,
      status: "completed",
      phase: "completed",
      nextNominatorTeamId: undefined,
      currentNomination: undefined,
      canComplete: false,
    },
  };
};
