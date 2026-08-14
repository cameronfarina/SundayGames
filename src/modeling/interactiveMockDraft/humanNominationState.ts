import type { Owner } from "../../../config/league.js";
import { normalizePlayerName } from "../../data/normalizePlayerName.js";
import type { AuctionDiagnosticsMode } from "../auctionEngine.js";
import { baseStateFor } from "./baseState.js";
import type { InteractiveMockDraftState } from "./contracts.js";
import {
  manualNominationPlayerFor,
  nominationForPlayer,
} from "./nomination.js";
import type { PreparedInteractiveMockDraft } from "./preparedContract.js";
import { stateForResolvedNomination } from "./resolvedNomination.js";

export const humanNominationStateFor = ({
  prepared,
  watchOwner,
  seed,
  pickIndex,
  nominationCursor,
  nominatedPlayer,
  nominatedPrice,
  diagnosticsMode,
}: {
  prepared: PreparedInteractiveMockDraft;
  watchOwner: Owner;
  seed: string;
  pickIndex: number;
  nominationCursor: number;
  nominatedPlayer?: string;
  nominatedPrice?: number;
  diagnosticsMode: AuctionDiagnosticsMode;
}): InteractiveMockDraftState => {
  if (!nominatedPlayer) {
    return {
      ...baseStateFor({
        phase: "human-nomination",
        prepared,
        watchOwner,
        seed,
        pickNumber: pickIndex + 1,
        nominationCursor,
        message: `${watchOwner} is up to nominate.`,
      }),
      nominator: watchOwner,
    };
  }

  const player = manualNominationPlayerFor(nominatedPlayer, prepared.auctionPlayers);
  if (!player) {
    return baseStateFor({
      phase: "blocked",
      prepared,
      watchOwner,
      seed,
      pickNumber: pickIndex + 1,
      nominationCursor,
      message: `Could not nominate "${nominatedPlayer}". Select an available player from the mock board.`,
    });
  }

  const nominatedName = normalizePlayerName(player.name);
  return stateForResolvedNomination({
    prepared,
    watchOwner,
    seed,
    pickIndex,
    nominationCursor,
    nominator: watchOwner,
    nomination: nominationForPlayer(player, prepared.liveState),
    player,
    remainingPlayers: prepared.auctionPlayers.filter(candidate =>
      normalizePlayerName(candidate.name) !== nominatedName
    ),
    diagnosticsMode,
    ...(nominatedPrice === undefined ? {} : { nominatedPrice }),
  });
};
