import { bidEventFor } from "./auctionEvents.js";
import type {
  InteractiveMockDraftBid,
  InteractiveMockDraftState,
} from "./contracts.js";

export const nextAiBidAfterCam = (
  state: InteractiveMockDraftState,
  camBid: number,
): InteractiveMockDraftBid | undefined => state.aiBids
  .filter(bid => bid.amount >= camBid + 1)
  .sort((left, right) =>
    right.amount - left.amount || left.owner.localeCompare(right.owner)
  )[0];

export const stateAfterAiRaise = (
  state: InteractiveMockDraftState,
  camBid: number,
  aiBid: InteractiveMockDraftBid,
): InteractiveMockDraftState => {
  if (!state.auction || !state.camDecision) {
    throw new Error(`${state.watchOwner} does not have a live auction decision.`);
  }

  const aiResponseAmount = camBid + 1;
  const nextCamBid = aiResponseAmount + 1;
  const feed = [
    ...state.auction.feed,
    bidEventFor(state.watchOwner, camBid),
    bidEventFor(aiBid.owner, aiResponseAmount),
  ];
  const camDecision = {
    ...state.camDecision,
    recommendedBid: nextCamBid,
    aiSalePrice: aiResponseAmount,
    topAiBid: Math.max(state.camDecision.topAiBid, aiResponseAmount),
    topAiBidOwner: aiBid.owner,
  };

  return {
    ...state,
    phase: "human-decision",
    camDecision,
    auction: {
      ...state.auction,
      status: "cam-decision",
      currentBid: aiResponseAmount,
      currentBidOwner: aiBid.owner,
      nextCamBid,
      camMaxBid: state.camDecision.maxBid,
      feed,
    },
  };
};
