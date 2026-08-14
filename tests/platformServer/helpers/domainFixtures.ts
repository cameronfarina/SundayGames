import { leagueConfig, ownerOrder } from "../../../config/league.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomInitialRosterPlayer } from "../../../src/platform/liveDraftRooms.js";
import type { SimulationMockBatchRunner } from "../../../src/platform/simulations.js";

export const now = new Date("2026-08-09T12:00:00.000Z");

export const completeInitialRostersFor = (
  season: LeagueSeason,
  openTeamId?: string,
): LiveDraftRoomInitialRosterPlayer[] => {
  const positions: LiveDraftRoomInitialRosterPlayer["position"][] = [
    "QB", "QB", "QB", "RB", "RB", "RB", "RB", "WR",
    "WR", "WR", "WR", "WR", "TE", "TE", "K", "DST",
  ];

  return season.teams.flatMap(team => positions
    .filter((_, index) => team.id !== openTeamId || index !== 11)
    .map((position, index): LiveDraftRoomInitialRosterPlayer => ({
      teamId: team.id,
      playerName: `${team.id} ${position} ${index + 1}`,
      position,
      price: 1,
      expectedPrice: 1,
      source: "imported",
    })));
};

export const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}) => ({
  options: {
    scenarioKeys: ["expected"],
    runsPerScenario,
    seedPrefix,
    forcedSales: [...forcedSales],
  },
  runs: [],
  summary: {
    runCount: runsPerScenario,
    scenarios: [],
    players: [],
    owners: [],
    ownerPlayerExposure: [],
  },
});

export interface JsonFetchResult {
  status: number;
  contentType: string | null;
  setCookie?: string | null;
  retryAfter?: string | null;
  body: unknown;
}

export const sessionTokenFrom = (response: JsonFetchResult): string => {
  const match = response.setCookie?.match(/(?:^|;\s*)mockd_session=([^;]+)/);
  if (match?.[1] === undefined) throw new Error("Expected a Mockd session cookie.");

  return decodeURIComponent(match[1]);
};
