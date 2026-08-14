import type { Owner } from "../../../config/league.js";
import type { Player } from "../../types.js";
import {
  resolveAuctionSale,
  type AuctionDiagnosticsMode,
} from "../auctionEngine.js";
import { auctionStateFor } from "./auctionState.js";
import { aiSaleCommandFor } from "./auctionEvents.js";
import { baseStateFor } from "./baseState.js";
import { camDecisionFor } from "./camDecision.js";
import type {
  InteractiveMockDraftNomination,
  InteractiveMockDraftPhase,
  InteractiveMockDraftState,
} from "./contracts.js";
import { topBidLimit } from "./defaults.js";
import { mockBidFor } from "./nomination.js";
import type { PreparedInteractiveMockDraft } from "./preparedContract.js";

export const stateForResolvedNomination = ({
  prepared,
  watchOwner,
  seed,
  pickIndex,
  nominationCursor,
  nominator,
  nomination,
  player,
  remainingPlayers,
  diagnosticsMode,
  nominatedPrice,
}: {
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickIndex: number;
  nominationCursor: number;
  nominator: Owner;
  nomination: InteractiveMockDraftNomination;
  player: Player;
  remainingPlayers: readonly Player[];
  diagnosticsMode: AuctionDiagnosticsMode;
  nominatedPrice?: number;
}): InteractiveMockDraftState => {
  const aiOwnerStates = prepared.ownerStates.filter(state => state.owner !== watchOwner);
  const aiSale = resolveAuctionSale(
    player,
    aiOwnerStates,
    remainingPlayers,
    prepared.config,
    { nominator, diagnosticsMode },
  );
  if (!aiSale) {
    return {
      ...baseStateFor({
        phase: "blocked",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor,
        message: "The AI room could not produce a legal bid for this nomination.",
      }),
      nominator,
      nomination,
    };
  }

  const topAiBidder = aiSale.bids[0];
  const topAiBid = topAiBidder?.amount ?? aiSale.price;
  const topAiBidOwner = topAiBidder?.owner ?? aiSale.winner;
  const watchOwnerState = prepared.ownerStates.find(state => state.owner === watchOwner);
  if (!watchOwnerState) throw new Error(`Unknown watch owner "${watchOwner}".`);

  const camDecision = camDecisionFor({
    liveState: prepared.liveState,
    watchOwnerState,
    player,
    topAiBid,
    topAiBidOwner,
    aiSalePrice: aiSale.price,
    minimumBid: prepared.config.minimumBid,
  });
  const phase: InteractiveMockDraftPhase = camDecision ? "human-decision" : "ai-sale";
  const auction = auctionStateFor({
    status: camDecision ? "cam-decision" : "ai-sale",
    nomination,
    nominator,
    aiSale,
    ...(camDecision === undefined ? {} : { camDecision }),
    config: prepared.config,
    ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
  });

  return {
    ...baseStateFor({
      phase,
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor,
    }),
    nominator,
    nomination,
    aiBids: aiSale.bids.slice(0, topBidLimit).map(bid => mockBidFor(bid, player)),
    auction,
    aiSaleCommand: aiSaleCommandFor(aiSale.winner, player.name, aiSale.price),
    ...(camDecision === undefined ? {} : { camDecision }),
  };
};
