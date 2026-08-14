import type { Position } from "../../../config/league.js";
import type { HistoricalCatalogCandidate } from "./playerCatalog.js";
import type {
  HistoricalPlayerResolutionCandidate,
  NormalizedHistoricalImportRow,
  PlayerResolution,
} from "./playerContracts.js";

export const resolvedPlayerRow = (
  row: NormalizedHistoricalImportRow,
  candidate: HistoricalPlayerResolutionCandidate,
): NormalizedHistoricalImportRow => ({
  ...row,
  playerId: candidate.playerId,
  playerName: candidate.playerName,
  position: candidate.position,
  playerResolution: {
    status: "resolved",
    playerId: candidate.playerId,
    playerName: candidate.playerName,
    position: candidate.position,
  },
});

export const unresolvedPlayerRow = (
  row: NormalizedHistoricalImportRow,
  candidates: readonly HistoricalPlayerResolutionCandidate[],
): NormalizedHistoricalImportRow => ({
  ...row,
  playerResolution: {
    status: "unresolved",
    required: true,
    ...(candidates.length === 0 ? {} : { candidates }),
  },
});

export const resolutionForMatches = (
  candidates: readonly HistoricalPlayerResolutionCandidate[],
  exactMatchIsAmbiguous: boolean,
): PlayerResolution => exactMatchIsAmbiguous
  ? { status: "ambiguous", required: true, candidates }
  : {
      status: "unresolved",
      required: true,
      ...(candidates.length === 0 ? {} : { candidates }),
    };

export const exactCandidatesFor = (
  sameName: readonly HistoricalCatalogCandidate[],
  position: Position,
  resolvePosition: (value: string | undefined) => Position | null,
): HistoricalPlayerResolutionCandidate[] => sameName
  .filter(candidate => resolvePosition(candidate.entry.position) === position)
  .map(candidate => candidate.candidate);
