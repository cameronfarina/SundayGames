import type { Owner } from "../../../config/league.js";
import type {
  AuctionBid,
  AuctionEngineConfig,
} from "../auctionEngine.js";
import { bidEventFor } from "./auctionEvents.js";
import type {
  InteractiveMockDraftAuctionEvent,
  InteractiveMockDraftNomination,
} from "./contracts.js";
import { topBidLimit } from "./defaults.js";

export const nominationOpeningBidFor = (
  nomination: InteractiveMockDraftNomination,
  currentBid: number,
  config: AuctionEngineConfig,
  nominatorOpeningBid: number,
  nominatedPrice?: number,
): number => {
  const modeledOpeningBid = nominatedPrice
    ?? (nominatorOpeningBid > 0 ? nominatorOpeningBid : nomination.marketPrice);
  return Math.max(config.minimumBid, Math.min(currentBid, modeledOpeningBid));
};

export const aiBidFeedFor = ({
  bids,
  currentBid,
  currentBidOwner,
  minimumBid,
  openingBid,
}: {
  bids: readonly AuctionBid[];
  currentBid: number;
  currentBidOwner: Owner;
  minimumBid: number;
  openingBid: number;
}): InteractiveMockDraftAuctionEvent[] => {
  if (currentBid <= openingBid) return [];

  const feed: InteractiveMockDraftAuctionEvent[] = [];
  const previousOwners = bids
    .filter(bid => bid.owner !== currentBidOwner && bid.amount > openingBid)
    .slice(0, topBidLimit)
    .sort((left, right) => left.amount - right.amount);
  let nextBid = openingBid + 1;

  for (const bid of previousOwners) {
    if (nextBid >= currentBid) break;
    if (bid.amount < nextBid) continue;
    feed.push(bidEventFor(bid.owner, nextBid));
    nextBid += minimumBid;
  }
  feed.push(bidEventFor(currentBidOwner, currentBid));
  return feed;
};
