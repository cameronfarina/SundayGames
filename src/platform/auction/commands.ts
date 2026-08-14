import { GenericAuctionMockError } from "./errors.js";
import {
  bidEventFor,
  withAuctionEvents,
} from "./events.js";
import {
  finalizeCommand,
  restoreLastDecision,
  withDecisionSnapshot,
} from "./history.js";
import {
  nominationFor,
  openNomination,
} from "./nomination.js";
import { advanceToHumanDecision } from "./progression.js";
import {
  assertCanAcquire,
  playerFor,
  teamFor,
} from "./roster.js";
import { createGenericAuctionMockState } from "./state.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockConfig,
  GenericAuctionMockState,
} from "./types.js";

export const applyGenericAuctionMockCommand = (
  state: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): GenericAuctionMockState => {
  if (command.expectedRevision !== state.session.revision) {
    throw new GenericAuctionMockError(
      "stale_revision",
      `Expected revision ${command.expectedRevision}, but the auction mock is at revision ${state.session.revision}.`,
    );
  }

  if (command.type === "start") {
    if (state.session.status !== "setup") {
      throw new GenericAuctionMockError("invalid_status", "The auction mock has already started.");
    }
    const started = advanceToHumanDecision({
      ...state,
      session: {
        ...state.session,
        status: "active",
      },
    });

    return finalizeCommand(state, started, command);
  }

  if (state.session.status !== "active") {
    throw new GenericAuctionMockError(
      "invalid_status",
      "Auction decisions require an active mock draft.",
    );
  }

  if (command.type === "undo") {
    return finalizeCommand(state, restoreLastDecision(state), command);
  }

  if (command.type === "complete") {
    if (!state.session.canComplete || state.teams.some(team => team.rosterSlotsRemaining > 0)) {
      throw new GenericAuctionMockError(
        "draft_incomplete",
        "Every team roster must be full before completing the auction mock.",
      );
    }

    return finalizeCommand(state, {
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
    }, command);
  }

  if (command.type === "nominate") {
    if (state.session.phase !== "awaiting_human_nomination") {
      throw new GenericAuctionMockError(
        "invalid_decision",
        "The human team does not have the current nomination.",
      );
    }
    const humanTeam = teamFor(state, state.configuration.humanTeamId);
    const player = playerFor(state, command.playerId);
    const openingBid = command.openingBid ?? state.configuration.minimumBidDollars;
    const decided = withDecisionSnapshot(state);
    const progressed = advanceToHumanDecision(openNomination(
      decided,
      humanTeam,
      player,
      openingBid,
    ));

    return finalizeCommand(state, progressed, command);
  }

  const nomination = state.session.currentNomination;
  if (state.session.phase !== "awaiting_human_bid" || nomination === undefined) {
    throw new GenericAuctionMockError(
      "invalid_decision",
      "There is no current nomination awaiting a human bid or pass.",
    );
  }

  if (command.type === "pass") {
    const decided = withDecisionSnapshot(state);
    const progressed = advanceToHumanDecision({
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

    return finalizeCommand(state, progressed, command);
  }

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
  const progressed = advanceToHumanDecision({
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

  return finalizeCommand(state, progressed, command);
};

export const replayGenericAuctionMock = (
  config: GenericAuctionMockConfig,
  commands: readonly GenericAuctionMockCommand[],
): GenericAuctionMockState => commands.reduce(
  (state, command) => applyGenericAuctionMockCommand(state, command),
  createGenericAuctionMockState(config),
);
