import { competitiveAuctionBidFor } from "../../auctionPriceFormation.js";
import { aiMaximumsFor, type AiMaximum } from "../aiMaximums.js";
import { GenericAuctionMockError } from "../errors.js";
import { nominationFor } from "../nomination.js";
import { playerFor, teamFor } from "../roster.js";
import type {
  GenericAuctionMockNomination,
  GenericAuctionMockState,
} from "../types.js";

export interface AdvancedAiBid {
  maximums: readonly AiMaximum[];
  nomination: GenericAuctionMockNomination;
}

export const advanceAiBid = (
  state: GenericAuctionMockState,
  nomination: GenericAuctionMockNomination,
): AdvancedAiBid | undefined => {
  const maximums = aiMaximumsFor(state, nomination);
  const bid = competitiveAuctionBidFor({
    currentPrice: nomination.currentPrice,
    highestBidderTeamId: nomination.highestBidderTeamId,
    maximums,
  });
  if (bid === undefined) return undefined;

  return {
    maximums,
    nomination: nominationFor({
      state,
      player: playerFor(state, nomination.playerId),
      nominatedByTeam: teamFor(state, nomination.nominatedByTeamId),
      highestBidderTeam: bid.team,
      currentPrice: bid.price,
      humanPassed: nomination.humanPassed,
    }),
  };
};

export const requireAdvancedAiBid = (
  state: GenericAuctionMockState,
  nomination: GenericAuctionMockNomination,
): AdvancedAiBid => {
  const advanced = advanceAiBid(state, nomination);
  if (advanced !== undefined) return advanced;

  const player = playerFor(state, nomination.playerId);
  throw new GenericAuctionMockError(
    "no_eligible_player",
    `No AI team can retain the current bid for ${player.name}.`,
  );
};
