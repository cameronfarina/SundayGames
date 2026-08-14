import { finalizeCommand } from "../history.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockState,
} from "../types.js";
import { buyNomination, passOnNomination } from "./humanDecision.js";
import {
  completeAuction,
  startAuction,
  undoAuctionDecision,
} from "./lifecycle.js";
import { nominatePlayer } from "./nominate.js";
import {
  assertAuctionActive,
  assertExpectedRevision,
} from "./preconditions.js";

export const applyGenericAuctionMockCommand = (
  state: GenericAuctionMockState,
  command: GenericAuctionMockCommand,
): GenericAuctionMockState => {
  assertExpectedRevision(state, command);

  if (command.type === "start") {
    return finalizeCommand(state, startAuction(state), command);
  }

  assertAuctionActive(state);
  if (command.type === "undo") {
    return finalizeCommand(state, undoAuctionDecision(state), command);
  }
  if (command.type === "complete") {
    return finalizeCommand(state, completeAuction(state), command);
  }
  if (command.type === "nominate") {
    return finalizeCommand(state, nominatePlayer(state, command), command);
  }
  if (command.type === "pass") {
    return finalizeCommand(state, passOnNomination(state), command);
  }

  return finalizeCommand(state, buyNomination(state, command), command);
};
