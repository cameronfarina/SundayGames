import type { Owner } from "../../../config/league.js";
import type { Player } from "../../types.js";
import { AuctionOwnerState } from "./auctionContracts.js";
import { AuctionDiagnosticsMode, AuctionEngineConfig } from "./configContracts.js";
import { buildNominationContext } from "./nominationContext.js";
import { nominationScoreFor } from "./nominationScore.js";
import { NominationSelection, UnrankedNominationCandidateDiagnostics, compareAuctionPlayers, highestMarketPrice, highestProjectionTotal, nominationDiagnosticCandidateLimit } from "./nominationTypes.js";

export const selectNominatedPlayer = ({
  availablePlayers,
  ownerStates,
  nominator,
  pickIndex,
  config,
  diagnosticsMode,
}: {
  availablePlayers: readonly Player[];
  ownerStates: readonly AuctionOwnerState[];
  nominator: Owner;
  pickIndex: number;
  config: AuctionEngineConfig;
  diagnosticsMode: AuctionDiagnosticsMode;
}): NominationSelection | undefined => {
  const topMarketPrice = highestMarketPrice(availablePlayers);
  const topProjectionTotal = highestProjectionTotal(availablePlayers);
  const nominationContext = buildNominationContext(availablePlayers, ownerStates, config);

  if (diagnosticsMode === "summary") {
    let selected: {
      index: number;
      player: Player;
      diagnostics: UnrankedNominationCandidateDiagnostics;
    } | undefined;
    let candidateCount = 0;

    for (const [index, player] of availablePlayers.entries()) {
      const diagnostics = nominationScoreFor({
        player,
        context: nominationContext,
        nominator,
        pickIndex,
        topMarketPrice,
        topProjectionTotal,
        config,
      });
      if (!diagnostics) continue;

      candidateCount += 1;
      if (
        !selected ||
        diagnostics.score > selected.diagnostics.score ||
        (diagnostics.score === selected.diagnostics.score && compareAuctionPlayers(player, selected.player) < 0)
      ) {
        selected = { index, player, diagnostics };
      }
    }

    if (!selected) return undefined;

    return {
      index: selected.index,
      player: selected.player,
      score: selected.diagnostics.score,
      diagnostics: {
        selectedPlayer: selected.player.name,
        selectedPosition: selected.player.position,
        selectedScore: selected.diagnostics.score,
        candidateCount,
        topCandidates: [],
      },
    };
  }

  const candidates: {
    index: number;
    player: Player;
    diagnostics: UnrankedNominationCandidateDiagnostics;
  }[] = [];

  for (const [index, player] of availablePlayers.entries()) {
    const diagnostics = nominationScoreFor({
      player,
      context: nominationContext,
      nominator,
      pickIndex,
      topMarketPrice,
      topProjectionTotal,
      config,
    });
    if (!diagnostics) continue;

    candidates.push({ index, player, diagnostics });
  }

  const rankedCandidates = candidates.sort((left, right) =>
    right.diagnostics.score - left.diagnostics.score ||
    compareAuctionPlayers(left.player, right.player),
  );
  const selected = rankedCandidates[0];
  if (!selected) return undefined;

  return {
    index: selected.index,
    player: selected.player,
    score: selected.diagnostics.score,
    diagnostics: {
      selectedPlayer: selected.player.name,
      selectedPosition: selected.player.position,
      selectedScore: selected.diagnostics.score,
      candidateCount: rankedCandidates.length,
      topCandidates: rankedCandidates
        .slice(0, nominationDiagnosticCandidateLimit)
        .map((candidate, index) => ({
          rank: index + 1,
          ...candidate.diagnostics,
        })),
    },
  };
};
