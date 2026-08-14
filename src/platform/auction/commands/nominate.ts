import { GenericAuctionMockError } from "../errors.js";
import { withDecisionSnapshot } from "../history.js";
import { openNomination } from "../nomination.js";
import { advanceToHumanDecision } from "../progression.js";
import { playerFor, teamFor } from "../roster.js";
import type {
  GenericAuctionMockCommand,
  GenericAuctionMockState,
} from "../types.js";

type NominateCommand = Extract<GenericAuctionMockCommand, { type: "nominate" }>;

export const nominatePlayer = (
  state: GenericAuctionMockState,
  command: NominateCommand,
): GenericAuctionMockState => {
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
  return advanceToHumanDecision(openNomination(
    decided,
    humanTeam,
    player,
    openingBid,
  ));
};
