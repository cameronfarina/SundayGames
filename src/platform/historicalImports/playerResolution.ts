import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { historicalImportIssue } from "./issues.js";
import { normalizePlayerId } from "./ids.js";
import {
  basePlayerIdForCatalogEntry,
  historicalCatalog,
  likelyPlayerCandidatesFor,
  type HistoricalCatalogCandidate,
} from "./playerCatalog.js";
import type {
  NormalizedHistoricalImportRow,
  ResolveHistoricalImportPlayersInput,
} from "./playerContracts.js";
import type { ResolveHistoricalImportPlayersResult } from "./issueContracts.js";
import { resolveHistoricalPosition } from "./position.js";
import {
  exactCandidatesFor,
  resolutionForMatches,
  resolvedPlayerRow,
  unresolvedPlayerRow,
} from "./playerResolutionRows.js";

const rowWithSuppliedId = (
  row: NormalizedHistoricalImportRow,
  suppliedPlayerId: string,
  playerName: string,
  catalog: readonly HistoricalCatalogCandidate[],
  issues: ResolveHistoricalImportPlayersResult["issues"],
): NormalizedHistoricalImportRow => {
  const position = resolveHistoricalPosition(row.position);
  const idMatches = catalog.filter(candidate => candidate.candidate.playerId === suppliedPlayerId);
  const match = idMatches.length === 1 ? idMatches[0] : undefined;
  const nameMatches = match?.nameKeys.has(canonicalPlayerIdentityKey(playerName)) ?? false;
  const catalogPosition = match === undefined ? null : resolveHistoricalPosition(match.entry.position);
  const positionMatches = position !== null && catalogPosition === position;
  if (match !== undefined && nameMatches && positionMatches) {
    return resolvedPlayerRow(row, match.candidate);
  }

  const message = match === undefined
    ? `Player ID "${suppliedPlayerId}" is not in the current player catalog.`
    : !nameMatches
      ? `Player ID "${suppliedPlayerId}" belongs to ${match.candidate.playerName}, not "${playerName}".`
      : `Player ID "${suppliedPlayerId}" is a ${match.candidate.position}, not ${row.position?.trim().toUpperCase() ?? "the supplied position"}.`;
  issues.push(historicalImportIssue(
    "player_unresolved",
    "blocker",
    `${message} Correct the row or remove the player ID to match by name and position.`,
    row.sourceRowNumber,
    {
      sourceValue: suppliedPlayerId,
      ...(match === undefined ? {} : { candidates: [match.candidate] }),
    },
  ));
  return unresolvedPlayerRow(row, match === undefined ? [] : [match.candidate]);
};

const historicalOnlyRow = (
  row: NormalizedHistoricalImportRow,
  playerName: string,
  position: Exclude<ReturnType<typeof resolveHistoricalPosition>, null>,
  catalog: readonly HistoricalCatalogCandidate[],
  issues: ResolveHistoricalImportPlayersResult["issues"],
): NormalizedHistoricalImportRow => {
  const playerId = basePlayerIdForCatalogEntry({ name: playerName, position });
  const candidates = likelyPlayerCandidatesFor(playerName, position, catalog);
  const matchCopy = candidates.length === 0
    ? "If this is a typo, correct the source file and replace this draft year."
    : `Possible current match: ${candidates.map(candidate =>
      `${candidate.playerName} (${candidate.position})`).join(", ")}. Correct the source file and replace this draft year if needed.`;
  issues.push(historicalImportIssue(
    "player_historical_only",
    "warning",
    `${playerName} (${position}) is not in the current player catalog and was imported as a historical-only player. ${matchCopy}`,
    row.sourceRowNumber,
    {
      sourceValue: playerName,
      ...(candidates.length === 0 ? {} : { candidates }),
    },
  ));
  return resolvedPlayerRow(row, { playerId, playerName, position });
};

export const resolveHistoricalImportPlayers = ({
  rows,
  playerCatalog,
}: ResolveHistoricalImportPlayersInput): ResolveHistoricalImportPlayersResult => {
  const issues: ResolveHistoricalImportPlayersResult["issues"] = [];
  const catalog = historicalCatalog(playerCatalog);
  const resolvedRows = rows.map(row => {
    const playerName = row.playerName?.trim() ?? "";
    const position = resolveHistoricalPosition(row.position);
    const suppliedPlayerId = normalizePlayerId(row.playerId);
    if (suppliedPlayerId !== null) {
      return rowWithSuppliedId(row, suppliedPlayerId, playerName, catalog, issues);
    }
    if (playerName.length === 0 || position === null) return { ...row };

    const nameKey = canonicalPlayerIdentityKey(playerName);
    const sameName = catalog.filter(candidate => candidate.nameKeys.has(nameKey));
    const exactCandidates = exactCandidatesFor(sameName, position, resolveHistoricalPosition);
    const exactMatch = exactCandidates.length === 1 ? exactCandidates[0] : undefined;
    if (exactMatch !== undefined) return resolvedPlayerRow(row, exactMatch);
    if (sameName.length === 0) {
      return historicalOnlyRow(row, playerName, position, catalog, issues);
    }

    const candidates = exactCandidates.length > 1
      ? exactCandidates
      : sameName.map(candidate => candidate.candidate);
    const exactMatchIsAmbiguous = exactCandidates.length > 1;
    issues.push(historicalImportIssue(
      exactMatchIsAmbiguous ? "player_ambiguous" : "player_unresolved",
      "blocker",
      exactMatchIsAmbiguous
        ? `Multiple ${position} players match "${playerName}". Choose the intended player.`
        : `No ${position} player in the current catalog matches "${playerName}".`,
      row.sourceRowNumber,
      {
        sourceValue: playerName,
        ...(candidates.length === 0 ? {} : { candidates }),
      },
    ));
    return { ...row, playerResolution: resolutionForMatches(candidates, exactMatchIsAmbiguous) };
  });

  return { rows: resolvedRows, issues };
};
