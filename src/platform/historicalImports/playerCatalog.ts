import type { Position } from "../../../config/league.js";
import { canonicalPlayerIdentityKey } from "../../data/normalizePlayerName.js";
import { normalizePlayerId } from "./ids.js";
import type {
  HistoricalImportPlayerCatalogEntry,
  HistoricalPlayerResolutionCandidate,
} from "./playerContracts.js";
import { resolveHistoricalPosition } from "./position.js";
import { editDistance, maximumFuzzyDistanceFor } from "./textDistance.js";

export interface HistoricalCatalogCandidate {
  entry: HistoricalImportPlayerCatalogEntry;
  candidate: HistoricalPlayerResolutionCandidate;
  nameKeys: ReadonlySet<string>;
}

export const basePlayerIdForCatalogEntry = (
  entry: HistoricalImportPlayerCatalogEntry,
): string => {
  const providedId = normalizePlayerId(entry.playerId);
  if (providedId !== null) return providedId;

  const nameSegment = canonicalPlayerIdentityKey(entry.name).replace(/[^a-z0-9]+/gu, "-");
  const positionSegment = entry.position.trim().toLowerCase().replace(/[^a-z0-9]+/gu, "-");
  return `player-${nameSegment}-${positionSegment}`;
};

const playerCandidateFor = (
  entry: HistoricalImportPlayerCatalogEntry,
  playerId: string,
): HistoricalPlayerResolutionCandidate => ({
  playerId,
  playerName: entry.name.trim(),
  position: entry.position.trim().toUpperCase(),
});

const catalogCandidatesFor = (
  playerCatalog: readonly HistoricalImportPlayerCatalogEntry[],
): HistoricalPlayerResolutionCandidate[] => {
  const baseIds = playerCatalog.map(basePlayerIdForCatalogEntry);
  const baseIdCounts = baseIds.reduce<Map<string, number>>((counts, playerId) => {
    counts.set(playerId, (counts.get(playerId) ?? 0) + 1);
    return counts;
  }, new Map<string, number>());
  const seenBaseIds = new Map<string, number>();

  return playerCatalog.map((entry, index) => {
    const baseId = baseIds[index] ?? basePlayerIdForCatalogEntry(entry);
    const occurrence = (seenBaseIds.get(baseId) ?? 0) + 1;
    seenBaseIds.set(baseId, occurrence);
    const playerId = normalizePlayerId(entry.playerId) !== null || baseIdCounts.get(baseId) === 1
      ? baseId
      : `${baseId}-${occurrence}`;
    return playerCandidateFor(entry, playerId);
  });
};

export const historicalCatalog = (
  playerCatalog: readonly HistoricalImportPlayerCatalogEntry[],
): HistoricalCatalogCandidate[] => {
  const candidates = catalogCandidatesFor(playerCatalog);
  return playerCatalog.map((entry, index) => ({
    entry,
    candidate: candidates[index] ?? playerCandidateFor(entry, basePlayerIdForCatalogEntry(entry)),
    nameKeys: new Set([entry.name, ...(entry.aliases ?? [])].map(canonicalPlayerIdentityKey)),
  }));
};

export const likelyPlayerCandidatesFor = (
  playerName: string,
  position: Position,
  catalog: readonly HistoricalCatalogCandidate[],
): HistoricalPlayerResolutionCandidate[] => {
  const sourceKey = canonicalPlayerIdentityKey(playerName);
  const rankedCandidates = catalog
    .filter(candidate => resolveHistoricalPosition(candidate.entry.position) === position)
    .map(candidate => {
      const candidateKey = canonicalPlayerIdentityKey(candidate.entry.name);
      return {
        candidate: candidate.candidate,
        distance: editDistance(sourceKey, candidateKey),
        longestLength: Math.max(sourceKey.length, candidateKey.length),
      };
    })
    .filter(({ distance, longestLength }) =>
      distance > 0
      && distance <= maximumFuzzyDistanceFor(longestLength)
      && distance / longestLength <= 0.2
    )
    .sort((left, right) =>
      left.distance - right.distance
      || left.candidate.playerName.localeCompare(right.candidate.playerName)
    );
  const closestDistance = rankedCandidates[0]?.distance;
  return rankedCandidates
    .filter(candidate => candidate.distance === closestDistance)
    .slice(0, 3)
    .map(candidate => candidate.candidate);
};
