import type { Owner } from "../../../config/league.js";
import {
  selectNominatedPlayer,
  type AuctionDiagnosticsMode,
} from "../auctionEngine.js";
import { baseStateFor } from "./baseState.js";
import type { InteractiveMockDraftState } from "./contracts.js";
import { nominationFor } from "./nomination.js";
import type { PreparedInteractiveMockDraft } from "./preparedContract.js";
import { stateForResolvedNomination } from "./resolvedNomination.js";

export const aiNominationStateFor = ({
  prepared,
  watchOwner,
  seed,
  pickIndex,
  nominationCursor,
  nominator,
  diagnosticsMode,
}: {
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickIndex: number;
  nominationCursor: number;
  nominator: Owner;
  diagnosticsMode: AuctionDiagnosticsMode;
}): InteractiveMockDraftState => {
  const nomination = selectNominatedPlayer({
    availablePlayers: prepared.auctionPlayers,
    ownerStates: prepared.ownerStates,
    nominator,
    pickIndex,
    config: prepared.config,
    diagnosticsMode,
  });
  if (!nomination) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor,
      message: "No legal nomination is available.",
    });
  }

  return stateForResolvedNomination({
    prepared,
    watchOwner,
    seed,
    pickIndex,
    nominationCursor,
    nominator,
    nomination: nominationFor(nomination),
    player: nomination.player,
    remainingPlayers: prepared.auctionPlayers.filter((_, index) =>
      index !== nomination.index
    ),
    diagnosticsMode,
  });
};
