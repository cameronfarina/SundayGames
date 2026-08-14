import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { Player } from "../../types.js";
import type { AuctionBid, NominationSelection } from "../auctionEngine.js";
import type { LiveDraftState } from "../liveDraft.js";
import type {
  InteractiveMockDraftBid,
  InteractiveMockDraftNomination,
} from "./contracts.js";
import { roundToTwo } from "./defaults.js";
import { topTargetsFor } from "./draftStateQueries.js";

export const mockBidFor = (
  bid: AuctionBid,
  player: Player,
): InteractiveMockDraftBid => ({
  owner: bid.owner,
  player: player.name,
  amount: bid.amount,
  maxBid: bid.maxBid,
  marketPrice: bid.marketPrice,
});

export const nominationFor = (
  selection: NominationSelection,
): InteractiveMockDraftNomination => ({
  player: selection.player.name,
  position: selection.player.position,
  marketPrice: selection.player.price,
  projectedWeeks1To4: roundToTwo(selection.player.weeks1To4),
  topCandidates: selection.diagnostics.topCandidates.map(candidate => ({
    rank: candidate.rank,
    player: candidate.player,
    position: candidate.position,
    marketPrice: candidate.marketPrice,
    score: roundToTwo(candidate.score),
  })),
});

export const nominationForPlayer = (
  player: Player,
  liveState: LiveDraftState,
): InteractiveMockDraftNomination => ({
  player: player.name,
  position: player.position,
  marketPrice: player.price,
  projectedWeeks1To4: roundToTwo(player.weeks1To4),
  topCandidates: topTargetsFor(liveState).slice(0, 8).map((target, index) => ({
    rank: index + 1,
    player: target.name,
    position: target.position,
    marketPrice: target.liveExpectedPrice,
    score: roundToTwo(target.valueScore),
  })),
});

export const manualNominationPlayerFor = (
  nominatedPlayer: string,
  auctionPlayers: readonly Player[],
): Player | undefined => {
  const normalized = normalizePlayerName(nominatedPlayer);
  return auctionPlayers.find(player => normalizePlayerName(player.name) === normalized)
    ?? auctionPlayers.find(player => normalizePlayerName(player.name).includes(normalized));
};
