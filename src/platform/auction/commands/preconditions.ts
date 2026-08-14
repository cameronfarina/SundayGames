import { GenericAuctionMockError } from "../errors.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockNomination,
  GenericAuctionMockState,
} from "../types.js";

export const assertExpectedRevision = (
  state: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): void => {
  if (command.expectedRevision !== state.session.revision) {
    throw new GenericAuctionMockError(
      "stale_revision",
      `Expected revision ${command.expectedRevision}, but the auction mock is at revision ${state.session.revision}.`,
    );
  }
};

export const assertAuctionActive = (state: GenericAuctionMockState): void => {
  if (state.session.status !== "active") {
    throw new GenericAuctionMockError(
      "invalid_status",
      "Auction decisions require an active mock draft.",
    );
  }
};

export const humanNominationFor = (
  state: GenericAuctionMockState,
): GenericAuctionMockNomination => {
  const nomination = state.session.currentNomination;
  if (state.session.phase !== "awaiting_human_bid" || nomination === undefined) {
    throw new GenericAuctionMockError(
      "invalid_decision",
      "There is no current nomination awaiting a human bid or pass.",
    );
  }

  return nomination;
};
