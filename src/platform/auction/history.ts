import { GenericAuctionMockError } from "./errors.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockSnapshot,
  GenericAuctionMockState,
} from "./types.js";

export const snapshotFor = (state: GenericAuctionMockState): GenericAuctionMockSnapshot => ({
  session: {
    status: state.session.status,
    phase: state.session.phase,
    nextNominatorTeamId: state.session.nextNominatorTeamId,
    currentNomination: state.session.currentNomination,
    nominationsCompleted: state.session.nominationsCompleted,
    canComplete: state.session.canComplete,
    nextNominatorIndex: state.nextNominatorIndex,
  },
  board: state.board,
  teams: state.teams,
  sales: state.sales,
  auctionEvents: state.auctionEvents,
});

export const withDecisionSnapshot = (state: GenericAuctionMockState): GenericAuctionMockState => ({
  ...state,
  decisionHistory: [...state.decisionHistory, snapshotFor(state)],
});

export const finalizeCommand = (
  previousState: GenericAuctionMockState,
  nextState: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): GenericAuctionMockState => ({
  ...nextState,
  session: {
    ...nextState.session,
    revision: previousState.session.revision + 1,
    canUndo: nextState.session.status === "active" && nextState.decisionHistory.length > 0,
    commandLog: [...previousState.session.commandLog, { ...command }],
  },
});

export const restoreLastDecision = (state: GenericAuctionMockState): GenericAuctionMockState => {
  const snapshot = state.decisionHistory.at(-1);
  if (snapshot === undefined) {
    throw new GenericAuctionMockError(
      "no_decision_to_undo",
      "There is no confirmed human auction decision to undo.",
    );
  }

  const remainingHistory = state.decisionHistory.slice(0, -1);
  return {
    ...state,
    nextNominatorIndex: snapshot.session.nextNominatorIndex,
    session: {
      ...state.session,
      status: snapshot.session.status,
      phase: snapshot.session.phase,
      nextNominatorTeamId: snapshot.session.nextNominatorTeamId,
      currentNomination: snapshot.session.currentNomination,
      nominationsCompleted: snapshot.session.nominationsCompleted,
      canComplete: snapshot.session.canComplete,
    },
    board: snapshot.board,
    teams: snapshot.teams,
    sales: snapshot.sales,
    auctionEvents: snapshot.auctionEvents,
    decisionHistory: remainingHistory,
  };
};
