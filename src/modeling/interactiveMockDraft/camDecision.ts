import type { Owner } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { Player } from "../../types.js";
import type { AuctionOwnerState } from "../auctionEngine.js";
import type { LiveDraftState } from "../liveDraft.js";
import type { InteractiveMockDraftCamDecision } from "./contracts.js";
import { watchOwnerCanRoster } from "./rosterEligibility.js";

export const camDecisionFor = ({
  liveState,
  watchOwnerState,
  player,
  topAiBid,
  topAiBidOwner,
  aiSalePrice,
  minimumBid,
}: {
  liveState: LiveDraftState;
  watchOwnerState: AuctionOwnerState;
  player: Player;
  topAiBid: number;
  topAiBidOwner: Owner;
  aiSalePrice: number;
  minimumBid: number;
}): InteractiveMockDraftCamDecision | undefined => {
  if (!watchOwnerCanRoster(watchOwnerState, player)) return undefined;

  const target = liveState.availableTargets.find(candidate =>
    normalizePlayerName(candidate.name) === normalizePlayerName(player.name)
  );
  if (!target) return undefined;

  const maxBid = Math.min(target.recommendedMaxBid, watchOwnerState.maxBid);
  if (maxBid <= aiSalePrice) return undefined;
  return {
    maxBid,
    recommendedBid: Math.min(maxBid, aiSalePrice + minimumBid),
    topAiBid,
    topAiBidOwner,
    aiSalePrice,
    valueGap: target.recommendedMaxBid - target.liveExpectedPrice,
  };
};
