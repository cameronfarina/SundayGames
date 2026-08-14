import type { Owner } from "../../../config/league.js";
import {
  aiSaleCommandFor,
  countdownAndSoldEventsFor,
} from "./auctionEvents.js";
import type {
  InteractiveMockDraftAuctionState,
  InteractiveMockDraftState,
} from "./contracts.js";

export const resolvedAuctionFor = (
  state: InteractiveMockDraftState,
  owner: Owner,
  price: number,
): { command: string; auction: InteractiveMockDraftAuctionState | undefined } => {
  if (!state.nomination) {
    throw new Error("No nominated player is available to resolve.");
  }

  const command = aiSaleCommandFor(owner, state.nomination.player, price);
  if (!state.auction) return { command, auction: undefined };

  return {
    command,
    auction: {
      ...state.auction,
      status: "sold",
      currentBid: price,
      currentBidOwner: owner,
      feed: [
        ...state.auction.feed,
        ...countdownAndSoldEventsFor(owner, price),
      ],
      resolution: { owner, price, command },
    },
  };
};
