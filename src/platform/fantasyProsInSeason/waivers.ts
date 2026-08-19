import type { Position } from "../../../config/league.js";
import type { FantasyProsWaiverBoard, FantasyProsWaiverPlayer } from "./contracts.js";
import type { FantasyProsInSeasonDataset } from "./dataset.js";
import { enrichRosterCandidate } from "./enrich.js";
import type { FantasyProsPlayerNewsIndex } from "./news.js";
import type { FantasyProsRosterCandidate } from "./roster.js";

/**
 * An ESPN ownership share below this reads as widely available. It only gates
 * the pre-season fallback; once real waiver rankings exist they decide.
 */
export const widelyAvailableOwnershipThreshold = 50;

/** Enough depth per position that a filter chip is never empty on its own. */
export const waiverCandidatesPerPosition = 12;

interface RankedCandidate {
  player: FantasyProsWaiverPlayer;
  rank: number;
}

const takePerPosition = (
  ranked: readonly RankedCandidate[],
): readonly FantasyProsWaiverPlayer[] => {
  const counts = new Map<Position, number>();
  const kept: FantasyProsWaiverPlayer[] = [];
  for (const candidate of [...ranked].sort((left, right) =>
    left.rank - right.rank || left.player.playerId.localeCompare(right.player.playerId))) {
    const taken = counts.get(candidate.player.position) ?? 0;
    if (taken >= waiverCandidatesPerPosition) continue;
    counts.set(candidate.player.position, taken + 1);
    kept.push(candidate.player);
  }
  return kept;
};

export const buildFantasyProsWaiverBoard = (
  freeAgents: readonly FantasyProsRosterCandidate[],
  dataset: FantasyProsInSeasonDataset,
  news: FantasyProsPlayerNewsIndex,
): FantasyProsWaiverBoard => {
  // Waiver rankings stay empty until the season starts, so the rest-of-season
  // set stands in and the payload says which one the reader is looking at.
  const useWaiverRankings = dataset.waiverRankings.size > 0;

  const ranked = freeAgents.flatMap<RankedCandidate>(candidate => {
    const player = enrichRosterCandidate(candidate, dataset, news);
    const fantasyProsPlayerId = player.fantasyProsPlayerId;
    if (fantasyProsPlayerId === undefined) return [];

    if (useWaiverRankings) {
      const waiver = dataset.waiverRankings.get(fantasyProsPlayerId);
      if (waiver === undefined) return [];
      return [{
        rank: waiver.rankEcr,
        player: { ...player, waiverRank: waiver.rankEcr, ownedEspn: waiver.ownedEspn },
      }];
    }

    const restOfSeason = dataset.restOfSeasonRankings.get(fantasyProsPlayerId);
    const ownedEspn = restOfSeason?.ownedEspn;
    // An unknown ownership share is not evidence of availability, so a player
    // without one is left off rather than counted as zero percent owned.
    if (restOfSeason === undefined || ownedEspn === undefined) return [];
    if (ownedEspn >= widelyAvailableOwnershipThreshold) return [];
    return [{ rank: restOfSeason.rankEcr, player: { ...player, ownedEspn } }];
  });

  return {
    source: useWaiverRankings ? "waiver_rankings" : "widely_available",
    ownershipThreshold: useWaiverRankings ? undefined : widelyAvailableOwnershipThreshold,
    players: takePerPosition(ranked),
  };
};
