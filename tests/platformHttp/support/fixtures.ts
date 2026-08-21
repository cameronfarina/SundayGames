import { leagueConfig, ownerOrder } from "../../../config/league.js";
import type { MockBatch } from "../../../src/modeling/mockBatch.js";
import type { LeagueSeason } from "../../../src/platform/leagueSeason.js";
import type { LiveDraftRoomPlayerCatalogEntry } from "../../../src/platform/liveDraftRooms.js";
import type { SimulationMockBatchRunner } from "../../../src/platform/simulations.js";

export const now = new Date("2026-08-09T12:00:00.000Z");

export const playerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Puka Nacua", position: "WR", expectedPrice: 73 },
  { name: "Xavier Legette", position: "WR", expectedPrice: 2 },
  { name: "Jahmyr Gibbs", position: "RB", expectedPrice: 72 },
  { name: "De'Von Achane", position: "RB", expectedPrice: 50 },
];

export const snakePlayerCatalog: readonly LiveDraftRoomPlayerCatalogEntry[] = [
  { name: "Player 1", position: "RB", expectedPrice: 50 },
  { name: "Player 2", position: "WR", expectedPrice: 49 },
  { name: "Player 3", position: "TE", expectedPrice: 48 },
  { name: "Player 4", position: "QB", expectedPrice: 47 },
  { name: "Player 5", position: "RB", expectedPrice: 46 },
  { name: "Player 6", position: "WR", expectedPrice: 45 },
  { name: "Player 7", position: "TE", expectedPrice: 44 },
  { name: "Player 8", position: "QB", expectedPrice: 43 },
];

export const snakeSeason = (): LeagueSeason => ({
  id: "snake-season-2026",
  leagueId: "snake-league",
  league: {
    id: "snake-league",
    externalLeagueId: "snake-1",
    name: "Snake League",
    provider: "espn",
  },
  seasonYear: 2026,
  setupStatus: "published",
  teams: ["Owner11", "Owner12", "Matt", "Nick"].map((name, index) => ({
    id: `snake-team-${index + 1}`,
    leagueSeasonId: "snake-season-2026",
    ownerId: `snake-owner-${index + 1}`,
    ownerDisplayName: name,
    displayName: `${name} Team`,
    draftOrderPosition: index + 1,
  })),
  settings: {
    expectedTeamCount: 4,
    draftFormat: "snake",
    scoring: {
      passingYards: 0.04,
      passingTouchdown: 4,
      rushingYards: 0.1,
      rushingTouchdown: 6,
      receivingYards: 0.1,
      receivingTouchdown: 6,
      reception: 0.5,
    },
    snake: {
      rounds: 2,
      order: ["snake-team-1", "snake-team-2", "snake-team-3", "snake-team-4"],
    },
    roster: {
      rosterSize: 2,
      lineup: { BENCH: 2 },
      lineupSlotCount: 2,
      rosterMaximums: { QB: 2, RB: 2, WR: 2, TE: 2, K: 1, DST: 1 },
    },
    keeperPolicy: {
      mode: "previous-cost-multiplier",
      multiplier: 1.2,
      rounding: "ceil",
    },
  },
});

export const mockRunner: SimulationMockBatchRunner = ({
  runsPerScenario,
  seedPrefix,
  forcedSales,
}): MockBatch => ({
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

export { leagueConfig, ownerOrder };
