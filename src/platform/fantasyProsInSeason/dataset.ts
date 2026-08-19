import { fantasyProsRestOfSeasonWeek } from "../../data/fantasyPros.js";
import type {
  FantasyProsRepository,
  FantasyProsStoredPlayer,
  FantasyProsStoredProjection,
  FantasyProsStoredRanking,
} from "../fantasyPros.js";
import { buildFantasyProsPlayerIndex } from "../fantasyProsMatching.js";
import type { FantasyProsPlayerIndex } from "../fantasyProsMatching.js";

export interface FantasyProsInSeasonDataset {
  week?: number | undefined;
  updatedAt?: string | undefined;
  index: FantasyProsPlayerIndex;
  weeklyRankings: ReadonlyMap<number, FantasyProsStoredRanking>;
  restOfSeasonRankings: ReadonlyMap<number, FantasyProsStoredRanking>;
  waiverRankings: ReadonlyMap<number, FantasyProsStoredRanking>;
  weeklyProjections: ReadonlyMap<number, FantasyProsStoredProjection>;
  restOfSeasonProjections: ReadonlyMap<number, FantasyProsStoredProjection>;
}

/**
 * Rankings for earlier weeks stay in the store, so the newest week present is
 * the current one. Rows for older weeks are dropped rather than blended.
 */
const currentWeekOnly = (
  rankings: readonly FantasyProsStoredRanking[],
): readonly FantasyProsStoredRanking[] => {
  const week = rankings.reduce((latest, ranking) => Math.max(latest, ranking.week), -1);
  return rankings.filter(ranking => ranking.week === week);
};

const byPlayerId = <TRecord extends { playerId: number }>(
  records: readonly TRecord[],
): ReadonlyMap<number, TRecord> => new Map(records.map(record => [record.playerId, record]));

/**
 * The stored player catalog holds 8,525 rows, far too much to read on a page
 * load, and a player with neither a ranking nor a projection has nothing to
 * show. So the match population is rebuilt from the rows already in hand.
 */
const matchPopulation = (
  sources: readonly (readonly {
    playerId: number;
    playerName: string;
    position: string;
    teamAbbreviation?: string | undefined;
    fetchedAt: string;
  }[])[],
): readonly FantasyProsStoredPlayer[] => {
  const players = new Map<number, FantasyProsStoredPlayer>();
  for (const source of sources) {
    for (const record of source) {
      const existing = players.get(record.playerId);
      if (existing !== undefined && existing.teamAbbreviation !== undefined) continue;
      players.set(record.playerId, {
        playerId: record.playerId,
        playerName: record.playerName,
        position: record.position,
        positions: [record.position],
        teamAbbreviation: record.teamAbbreviation,
        fetchedAt: record.fetchedAt,
      });
    }
  }
  return [...players.values()];
};

const latestFetchedAt = (
  sources: readonly (readonly { fetchedAt: string }[])[],
): string | undefined => {
  const stamps = sources.flatMap(source => source.map(record => record.fetchedAt)).sort();
  return stamps[stamps.length - 1];
};

export const emptyFantasyProsInSeasonDataset = (): FantasyProsInSeasonDataset => ({
  index: buildFantasyProsPlayerIndex({ players: [] }),
  weeklyRankings: new Map(),
  restOfSeasonRankings: new Map(),
  waiverRankings: new Map(),
  weeklyProjections: new Map(),
  restOfSeasonProjections: new Map(),
});

export const loadFantasyProsInSeasonDataset = async (
  repository: FantasyProsRepository,
): Promise<FantasyProsInSeasonDataset> => {
  const [weeklyStored, restOfSeasonStored, waiverStored] = await Promise.all([
    repository.rankings({ rankingType: "weekly" }),
    repository.rankings({ rankingType: "ros" }),
    repository.rankings({ rankingType: "waiver" }),
  ]);
  const weekly = currentWeekOnly(weeklyStored);
  const restOfSeason = currentWeekOnly(restOfSeasonStored);
  const waiver = currentWeekOnly(waiverStored);
  const week = weekly[0]?.week;

  const [weeklyProjections, restOfSeasonProjections] = await Promise.all([
    week === undefined
      ? Promise.resolve([])
      : repository.projections({ week }),
    repository.projections({ week: fantasyProsRestOfSeasonWeek }),
  ]);

  const sources = [weekly, restOfSeason, waiver, weeklyProjections, restOfSeasonProjections];
  return {
    week,
    updatedAt: latestFetchedAt(sources),
    index: buildFantasyProsPlayerIndex({ players: matchPopulation(sources) }),
    weeklyRankings: byPlayerId(weekly),
    restOfSeasonRankings: byPlayerId(restOfSeason),
    waiverRankings: byPlayerId(waiver),
    weeklyProjections: byPlayerId(weeklyProjections),
    restOfSeasonProjections: byPlayerId(restOfSeasonProjections),
  };
};
