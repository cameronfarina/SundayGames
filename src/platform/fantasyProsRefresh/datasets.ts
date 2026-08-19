import {
  fantasyProsProjectionPositions,
  fantasyProsRestOfSeasonWeek,
  type FantasyProsRankingType,
} from "../../data/fantasyPros.js";
import type { FantasyProsRepository } from "../fantasyPros.js";
import type { FantasyProsDatasetRefresh, FantasyProsDatasetRunResult } from "./contracts.js";

const hoursMs = 60 * 60 * 1000;

export const fantasyProsRankingsCadenceMs = 6 * hoursMs;
export const fantasyProsProjectionsCadenceMs = 6 * hoursMs;
export const fantasyProsPlayersCadenceMs = 24 * hoursMs;

/**
 * Daily request budget, against a 500 per day account quota:
 *   rankings    3 requests x 4 cycles/day  = 12
 *   projections 6 positions x 2 weeks x 4  = 48
 *   players     1 request  x 1 cycle/day   =  1
 *                                    total = 61
 * Every scheduled fetch is gated on a stored timestamp, so extra instances
 * during a deploy add no requests.
 */
export const fantasyProsDailyRequestBudget = 61;

const failureText = (label: string, error: unknown): string =>
  `${label}: ${error instanceof Error ? error.message : String(error)}`;

const rankingsRefresh = (
  dataset: "rankings-weekly" | "rankings-ros" | "rankings-waiver",
  rankingType: FantasyProsRankingType,
): FantasyProsDatasetRefresh => ({
  dataset,
  cadenceMs: fantasyProsRankingsCadenceMs,
  requestCount: 1,
  run: async ({ client, repository, fetchedAt }) => {
    // The week is left off the request so FantasyPros reports the current week
    // itself; the echoed value is what gets stored.
    const set = await client.fetchRankings({ type: rankingType });
    await repository.saveRankings({
      rankingType: set.type,
      scoring: set.scoring,
      week: set.week,
      rankings: set.rankings,
      fetchedAt,
    });
    return { rowCount: set.rankings.length, failures: [] };
  },
});

const currentWeeklyRankingWeek = async (
  repository: FantasyProsRepository,
): Promise<number> => {
  // FantasyPros is the source of truth for "what week is it", so the weekly
  // projections follow the week the weekly rankings last reported.
  const [latest] = await repository.rankings({ rankingType: "weekly" });
  return latest?.week ?? 1;
};

const projectionsRefresh = (
  dataset: "projections-weekly" | "projections-ros",
  weekFor: (repository: FantasyProsRepository) => Promise<number>,
): FantasyProsDatasetRefresh => ({
  dataset,
  cadenceMs: fantasyProsProjectionsCadenceMs,
  requestCount: fantasyProsProjectionPositions.length,
  run: async ({ client, repository, fetchedAt }) => {
    const week = await weekFor(repository);
    const failures: string[] = [];
    let rowCount = 0;
    for (const position of fantasyProsProjectionPositions) {
      // One position failing must not discard the other five. Before this,
      // a single transient response zeroed the whole dataset.
      try {
        const set = await client.fetchProjections({ position, week });
        await repository.saveProjections({
          week: set.week,
          position: set.position,
          projections: set.projections,
          fetchedAt,
        });
        rowCount += set.projections.length;
      } catch (error) {
        failures.push(failureText(position, error));
      }
    }
    return { rowCount, failures };
  },
});

const playersRefresh: FantasyProsDatasetRefresh = {
  dataset: "players",
  cadenceMs: fantasyProsPlayersCadenceMs,
  requestCount: 1,
  run: async ({ client, repository, fetchedAt }): Promise<FantasyProsDatasetRunResult> => {
    const players = await client.fetchPlayers();
    await repository.savePlayers({ players, fetchedAt });
    return { rowCount: players.length, failures: [] };
  },
};

export const fantasyProsDatasetRefreshes: readonly FantasyProsDatasetRefresh[] = [
  rankingsRefresh("rankings-weekly", "weekly"),
  rankingsRefresh("rankings-ros", "ros"),
  rankingsRefresh("rankings-waiver", "waiver"),
  projectionsRefresh("projections-weekly", currentWeeklyRankingWeek),
  projectionsRefresh("projections-ros", async () => fantasyProsRestOfSeasonWeek),
  playersRefresh,
];
