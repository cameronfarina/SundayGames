import type { Owner } from "../../../config/league.js";
import type {
  AuctionEngineConfig,
  AuctionSale,
} from "../auctionEngine.js";
import { aiBidFeedFor, nominationOpeningBidFor } from "./auctionFeed.js";
import { aiSaleCommandFor, auctionEvent, dollarText } from "./auctionEvents.js";
import type {
  InteractiveMockDraftAuctionState,
  InteractiveMockDraftAuctionStatus,
  InteractiveMockDraftCamDecision,
  InteractiveMockDraftNomination,
} from "./contracts.js";

export const auctionStateFor = ({
  status,
  nomination,
  nominator,
  aiSale,
  camDecision,
  config,
  nominatedPrice,
}: {
  status: InteractiveMockDraftAuctionStatus;
  nomination: InteractiveMockDraftNomination;
  nominator: Owner;
  aiSale: AuctionSale;
  camDecision?: InteractiveMockDraftCamDecision;
  config: AuctionEngineConfig;
  nominatedPrice?: number;
}): InteractiveMockDraftAuctionState => {
  const currentBid = aiSale.price;
  const currentBidOwner = aiSale.winner;
  const openingBid = nominationOpeningBidFor(
    nomination,
    currentBid,
    config,
    aiSale.diagnostics.nominatorOpeningBid,
    nominatedPrice,
  );
  const feed = [
    auctionEvent({
      type: "nomination",
      owner: nominator,
      amount: openingBid,
      text: `${nominator} nominated ${nomination.player} for ${dollarText(openingBid)}`,
    }),
    ...aiBidFeedFor({
      bids: aiSale.bids,
      currentBid,
      currentBidOwner,
      minimumBid: config.minimumBid,
      openingBid,
    }),
  ];
  const resolution = {
    owner: aiSale.winner,
    price: aiSale.price,
    command: aiSaleCommandFor(aiSale.winner, nomination.player, aiSale.price),
  };

  if (status === "ai-sale") {
    return {
      status,
      player: nomination.player,
      position: nomination.position,
      nominator,
      openingBid,
      currentBid,
      currentBidOwner,
      feed,
      resolution,
    };
  }
  return {
    status,
    player: nomination.player,
    position: nomination.position,
    nominator,
    openingBid,
    currentBid,
    currentBidOwner,
    ...(camDecision === undefined ? {} : {
      nextCamBid: camDecision.recommendedBid,
      camMaxBid: camDecision.maxBid,
    }),
    feed,
  };
};
